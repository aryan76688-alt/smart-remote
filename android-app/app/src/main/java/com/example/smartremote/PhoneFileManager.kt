package com.example.smartremote

import android.content.Context
import android.os.Build
import android.os.Environment
import android.os.StatFs
import android.webkit.MimeTypeMap
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.io.FileInputStream
import java.io.FileOutputStream
import java.io.OutputStream
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.zip.ZipEntry
import java.util.zip.ZipOutputStream

object PhoneFileManager {

    val rootStoragePath: String
        get() = Environment.getExternalStorageDirectory().absolutePath

    fun hasAllFilesAccess(): Boolean {
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            Environment.isExternalStorageManager()
        } else {
            true
        }
    }

    fun getStorageStats(): JSONObject {
        val root = Environment.getExternalStorageDirectory()
        val stat = StatFs(root.path)
        val blockSize = stat.blockSizeLong
        val totalBlocks = stat.blockCountLong
        val availableBlocks = stat.availableBlocksLong
        val freeBlocks = stat.freeBlocksLong

        val totalBytes = totalBlocks * blockSize
        val freeBytes = freeBlocks * blockSize
        val usedBytes = totalBytes - freeBytes

        val totalGb = String.format(Locale.US, "%.1f", totalBytes / (1024.0 * 1024.0 * 1024.0)).toDoubleOrNull() ?: 128.0
        val usedGb = String.format(Locale.US, "%.1f", usedBytes / (1024.0 * 1024.0 * 1024.0)).toDoubleOrNull() ?: 64.0
        val freeGb = String.format(Locale.US, "%.1f", freeBytes / (1024.0 * 1024.0 * 1024.0)).toDoubleOrNull() ?: 64.0
        val usedPercent = if (totalBytes > 0) ((usedBytes.toDouble() / totalBytes.toDouble()) * 100.0) else 50.0

        // Quick rough sizes for common categories
        var imagesBytes: Long = 0
        var videosBytes: Long = 0
        var audioBytes: Long = 0
        var docsBytes: Long = 0

        fun getFolderSize(dir: File, maxDepth: Int = 2, currentDepth: Int = 0): Long {
            if (!dir.exists() || !dir.isDirectory || currentDepth > maxDepth) return 0L
            var size = 0L
            dir.listFiles()?.forEach { f ->
                if (f.isFile) size += f.length()
                else if (f.isDirectory) size += getFolderSize(f, maxDepth, currentDepth + 1)
            }
            return size
        }

        try {
            val dcim = File(root, "DCIM")
            val pictures = File(root, "Pictures")
            imagesBytes = getFolderSize(dcim) + getFolderSize(pictures)

            val movies = File(root, "Movies")
            videosBytes = getFolderSize(movies)

            val music = File(root, "Music")
            audioBytes = getFolderSize(music)

            val documents = File(root, "Documents")
            val download = File(root, "Download")
            docsBytes = getFolderSize(documents) + getFolderSize(download)
        } catch (_: Exception) {}

        val otherBytes = (usedBytes - (imagesBytes + videosBytes + audioBytes + docsBytes)).coerceAtLeast(0L)

        val breakdown = JSONObject().apply {
            put("images_bytes", imagesBytes)
            put("videos_bytes", videosBytes)
            put("audio_bytes", audioBytes)
            put("documents_bytes", docsBytes)
            put("system_other_bytes", otherBytes)
        }

        return JSONObject().apply {
            put("success", true)
            put("total_bytes", totalBytes)
            put("used_bytes", usedBytes)
            put("free_bytes", freeBytes)
            put("total_gb", totalGb)
            put("used_gb", usedGb)
            put("free_gb", freeGb)
            put("used_percent", String.format(Locale.US, "%.1f", usedPercent).toDoubleOrNull() ?: 50.0)
            put("has_all_files_access", hasAllFilesAccess())
            put("breakdown", breakdown)
        }
    }

    fun listDirectory(requestedPath: String?): JSONObject {
        val targetPath = if (requestedPath.isNullOrBlank() || requestedPath == "/") rootStoragePath else requestedPath
        val target = File(targetPath)

        if (!target.exists()) {
            return JSONObject().apply {
                put("success", false)
                put("error", "Directory not found: $targetPath")
                put("current_path", targetPath)
                put("items", JSONArray())
            }
        }

        val itemsArray = JSONArray()
        val sdf = SimpleDateFormat("yyyy-MM-dd HH:mm:ss", Locale.getDefault())

        val files = target.listFiles() ?: emptyArray()
        val sortedFiles = files.sortedWith(compareBy({ !it.isDirectory }, { it.name.lowercase(Locale.ROOT) }))

        for (file in sortedFiles) {
            val isDir = file.isDirectory
            val ext = if (isDir) "" else "." + file.extension.lowercase(Locale.ROOT)
            val mime = if (isDir) "folder" else getMimeType(file)
            val perms = (if (file.canRead()) "r" else "-") + (if (file.canWrite()) "w" else "-") + (if (file.canExecute()) "x" else "-")

            val itemObj = JSONObject().apply {
                put("name", file.name)
                put("path", file.absolutePath)
                put("is_dir", isDir)
                put("size_bytes", if (isDir) 0L else file.length())
                put("modified_time", sdf.format(Date(file.lastModified())))
                put("permissions", perms)
                put("mime_type", mime)
                put("extension", ext)
            }
            itemsArray.put(itemObj)
        }

        val parentPath = if (target.absolutePath == rootStoragePath) null else target.parent

        return JSONObject().apply {
            put("success", true)
            put("current_path", target.absolutePath)
            put("parent_path", parentPath)
            put("items", itemsArray)
            put("total_count", itemsArray.length())
        }
    }

    fun readFile(filePath: String): JSONObject {
        val file = File(filePath)
        if (!file.exists() || file.isDirectory) {
            return JSONObject().apply {
                put("success", false)
                put("error", "File not found or is a directory")
            }
        }

        if (file.length() > 5 * 1024 * 1024) {
            return JSONObject().apply {
                put("success", false)
                put("error", "File size exceeds 5MB inline preview limit")
            }
        }

        return try {
            val content = file.readText(Charsets.UTF_8)
            JSONObject().apply {
                put("success", true)
                put("path", file.absolutePath)
                put("name", file.name)
                put("size_bytes", file.length())
                put("content", content)
                put("is_text", true)
                put("mime_type", getMimeType(file))
            }
        } catch (e: Exception) {
            JSONObject().apply {
                put("success", false)
                put("error", "Failed to read file: ${e.message}")
            }
        }
    }

    fun writeFile(filePath: String, content: String): Boolean {
        return try {
            val file = File(filePath)
            file.parentFile?.mkdirs()
            file.writeText(content, Charsets.UTF_8)
            true
        } catch (_: Exception) {
            false
        }
    }

    fun deleteItem(path: String): Boolean {
        return try {
            val file = File(path)
            if (file.isDirectory) file.deleteRecursively() else file.delete()
        } catch (_: Exception) {
            false
        }
    }

    fun createItem(path: String, isDirectory: Boolean): Boolean {
        return try {
            val file = File(path)
            if (isDirectory) {
                file.mkdirs()
            } else {
                file.parentFile?.mkdirs()
                file.createNewFile()
            }
        } catch (_: Exception) {
            false
        }
    }

    fun exportToZip(paths: List<String>, outputStream: OutputStream) {
        ZipOutputStream(outputStream).use { zos ->
            for (p in paths) {
                val f = File(p)
                if (!f.exists()) continue
                if (f.isFile) {
                    addFileToZip(f, f.name, zos)
                } else if (f.isDirectory) {
                    addFolderToZip(f, f.name, zos)
                }
            }
            zos.finish()
        }
    }

    private fun addFolderToZip(folder: File, parentPath: String, zos: ZipOutputStream) {
        val entryName = if (parentPath.endsWith("/")) parentPath else "$parentPath/"
        zos.putNextEntry(ZipEntry(entryName))
        zos.closeEntry()

        val children = folder.listFiles() ?: return
        for (child in children) {
            val childPath = "$entryName${child.name}"
            if (child.isDirectory) {
                addFolderToZip(child, childPath, zos)
            } else {
                addFileToZip(child, childPath, zos)
            }
        }
    }

    private fun addFileToZip(file: File, entryPath: String, zos: ZipOutputStream) {
        try {
            FileInputStream(file).use { fis ->
                zos.putNextEntry(ZipEntry(entryPath))
                val buffer = ByteArray(16384)
                var length: Int
                while (fis.read(buffer).also { length = it } > 0) {
                    zos.write(buffer, 0, length)
                }
                zos.closeEntry()
            }
        } catch (_: Exception) {}
    }

    private fun getMimeType(file: File): String {
        val ext = file.extension.lowercase(Locale.ROOT)
        val mime = MimeTypeMap.getSingleton().getMimeTypeFromExtension(ext)
        if (mime != null) return mime

        return when (ext) {
            "json" -> "application/json"
            "txt", "log", "cfg", "conf", "ini", "properties" -> "text/plain"
            "py" -> "text/x-python"
            "sh", "bash" -> "text/x-shellscript"
            "js" -> "application/javascript"
            "ts", "tsx" -> "text/typescript"
            "apk" -> "application/vnd.android.package-archive"
            "zip" -> "application/zip"
            "pdf" -> "application/pdf"
            "mp4", "mkv", "webm", "avi" -> "video/mp4"
            "mp3", "m4a", "wav", "ogg", "flac" -> "audio/mpeg"
            "jpg", "jpeg", "png", "webp", "gif", "svg" -> "image/jpeg"
            else -> "application/octet-stream"
        }
    }
}
