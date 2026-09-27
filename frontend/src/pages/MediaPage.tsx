import React from 'react';
import { MediaRemoteTab } from '../components/remote/MediaRemoteTab';

export const MediaPage: React.FC = () => {
  return (
    <div className="p-4 overflow-y-auto h-[calc(100vh-3.5rem)] pb-24">
      <MediaRemoteTab />
    </div>
  );
};
