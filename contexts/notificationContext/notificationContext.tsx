import React, { createContext, useContext, useState } from 'react';

interface NotificationContextType {
  showNotificationChatDot: boolean;
  setShowNotificationChatDot: (value: boolean) => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [showNotificationChatDot, setShowNotificationChatDot] = useState(false);

  const value: NotificationContextType = {
    showNotificationChatDot, 
    setShowNotificationChatDot
  };
  
  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
};

export const useNotification = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotification must be used within a NotificationProvider');
  }
  return context;
};