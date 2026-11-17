import React from 'react';
import { Delete, CornerDownLeft, Hash } from 'lucide-react';
import { useWebSocket } from '../../context/WebSocketContext';
import { useApp } from '../../context/AppContext';

export const TacticalNumpadTab: React.FC = () => {
  const { sendInput } = useWebSocket();
  const { triggerHaptic } = useApp();

  const handleKey = (key: string) => {
    triggerHaptic(25);
    sendInput({ type: 'key', key });
  };

  const keys = [
    [
      { label: 'ESC', key: 'Escape', cls: 'bg-rose-950/60 text-rose-300 border-rose-800' },
      { label: '/', key: 'KP_Divide', cls: 'bg-slate-800 text-cyan-300' },
      { label: '*', key: 'KP_Multiply', cls: 'bg-slate-800 text-cyan-300' },
      { label: '⌫', key: 'BackSpace', icon: Delete, cls: 'bg-slate-800 text-amber-400' }
    ],
    [
      { label: '7', key: 'KP_7', cls: 'bg-slate-900 text-slate-100 font-bold' },
      { label: '8', key: 'KP_8', cls: 'bg-slate-900 text-slate-100 font-bold' },
      { label: '9', key: 'KP_9', cls: 'bg-slate-900 text-slate-100 font-bold' },
      { label: '-', key: 'KP_Subtract', cls: 'bg-slate-800 text-cyan-300' }
    ],
    [
      { label: '4', key: 'KP_4', cls: 'bg-slate-900 text-slate-100 font-bold' },
      { label: '5', key: 'KP_5', cls: 'bg-slate-900 text-slate-100 font-bold' },
      { label: '6', key: 'KP_6', cls: 'bg-slate-900 text-slate-100 font-bold' },
      { label: '+', key: 'KP_Add', cls: 'bg-slate-800 text-cyan-300' }
    ],
    [
      { label: '1', key: 'KP_1', cls: 'bg-slate-900 text-slate-100 font-bold' },
      { label: '2', key: 'KP_2', cls: 'bg-slate-900 text-slate-100 font-bold' },
      { label: '3', key: 'KP_3', cls: 'bg-slate-900 text-slate-100 font-bold' },
      { label: 'TAB', key: 'Tab', cls: 'bg-slate-800 text-slate-300' }
    ],
    [
      { label: '0', key: 'KP_0', span: 2, cls: 'bg-slate-900 text-slate-100 font-bold' },
      { label: '.', key: 'KP_Decimal', cls: 'bg-slate-900 text-slate-100 font-bold' },
      { label: 'ENTER', key: 'Return', icon: CornerDownLeft, cls: 'bg-cyan-600/40 text-cyan-200 border-cyan-500 font-bold' }
    ]
  ];

  return (
    <div className="p-3 max-w-sm mx-auto space-y-3 font-mono">
      <div className="flex items-center justify-between text-xs text-slate-400 px-1">
        <span className="flex items-center gap-1.5 font-bold">
          <Hash className="w-4 h-4 text-cyan-400" /> TACTICAL NUMPAD
        </span>
        <span className="text-[10px] text-slate-500">RAW X11 KEYCODES</span>
      </div>

      <div className="space-y-2 bg-slate-950/80 p-3 rounded-2xl border border-slate-800 shadow-xl">
        {keys.map((row, rIdx) => (
          <div key={rIdx} className="grid grid-cols-4 gap-2">
            {row.map((btn: any, cIdx: number) => {
              const Icon = btn.icon;
              return (
                <button
                  key={cIdx}
                  onClick={() => handleKey(btn.key)}
                  className={`h-14 rounded-xl border border-slate-800 flex items-center justify-center text-sm active:scale-95 transition-all shadow-md active:bg-cyan-500 active:text-white ${
                    btn.span === 2 ? 'col-span-2' : ''
                  } ${btn.cls}`}
                >
                  {Icon ? <Icon className="w-5 h-5" /> : btn.label}
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
};
