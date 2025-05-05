import SQLite from 'react-native-sqlite-storage';

export interface MessageDTO {
  id: string;
  senderId: string;
  encryptedMessage: string;
  timestamp: number;
  authTag: string;
}

export interface Message {
  id: string;
  message: string;
  timestamp: number;
  sendByMe: boolean;
}

export const chatHistory_db = SQLite.openDatabase({ name: 'chatHistory.db', location: 'default' });

export const setupDatabase = async (peerId: string) => {
  const sanitizedPeerId = peerId.replace(/[^a-zA-Z0-9]/g, '_');
  const tableName = `chat_${sanitizedPeerId}`;
  try {
    (await chatHistory_db).transaction(tx =>
      tx.executeSql(
        `CREATE TABLE IF NOT EXISTS ${tableName} (
          id TEXT PRIMARY KEY,
          message TEXT,
          timestamp INTEGER,
          send_by_me INTEGER
        )`,
        [],
        () => console.log(`Table ${tableName} created or exists`),
        (_, error) => { throw error; }
      )
    );
  } catch (error) {
    console.error('Error creating table:', error);
  }
};

export const saveMessageToLocalDB = async (messageData: Message, chatPeerId: string) => {
  const sanitizedPeerId = chatPeerId.replace(/[^a-zA-Z0-9]/g, '_');
  const tableName = `chat_${sanitizedPeerId}`;
  try {
    (await chatHistory_db).transaction(tx =>
      tx.executeSql(
        `INSERT INTO ${tableName} (id, message, timestamp, send_by_me) VALUES (?, ?, ?, ?)`,
        [
          messageData.id,
          messageData.message,
          messageData.timestamp,
          messageData.sendByMe ? 1 : 0
        ],
        (_, result) => console.log(`Inserted into ${tableName}, rows affected: ${result.rowsAffected}`),
        (_, error) => { throw error; }
      )
    );
  } catch (error) {
    console.error('Error inserting message:', error);
  }
};

export const clearDatabase = async () => {
  try {
      await (await chatHistory_db).transaction(tx => {
          // Get all tables that match the chat_% pattern
          tx.executeSql(
              "SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'chat_%'",
              [],
              async (_, { rows }) => {
                  const tables = rows.raw();
                  // Drop each table
                  for (const table of tables) {
                      await tx.executeSql(
                          `DROP TABLE IF EXISTS ${table.name}`,
                          [],
                          () => console.log(`Dropped table ${table.name}`),
                          (_, error) => { throw error; }
                      );
                  }
              },
              (_, error) => { throw error; }
          );
      });
      console.log('Database cleared successfully');
      return true
  } catch (error) {
      console.error('Error clearing database:', error);
      return false
  }
};

export const fetchMessagesFromDB = async (peerId: string, offset: number, limit: number): Promise<Message[]> => {
  const sanitizedPeerId = peerId.replace(/[^a-zA-Z0-9]/g, '_');
  const tableName = `chat_${sanitizedPeerId}`;
  try {
    const results = await new Promise<Message[]>(async (resolve, reject) => {
      (await chatHistory_db).transaction(tx => {
        tx.executeSql(
          `SELECT * FROM ${tableName} ORDER BY timestamp DESC LIMIT ? OFFSET ?`,
          [limit, offset],
          (_, { rows }) => {
            const messages: Message[] = rows.raw().map(row => ({
              id: row.id,
              message: row.message,
              timestamp: row.timestamp,
              sendByMe: !!row.send_by_me,
            }));
            resolve(messages);
          },
          (_, error) => reject(error)
        );
      });
    });
    return results;
  } catch (error) {
    return [];
  }
};

export const deleteChatForPeerId = async (peerId: string): Promise<boolean> => {
  const sanitizedPeerId = peerId.replace(/[^a-zA-Z0-9]/g, '_');
  const tableName = `chat_${sanitizedPeerId}`;
  try {
    await (await chatHistory_db).transaction(tx =>
      tx.executeSql(
        `DELETE FROM ${tableName}`,
        [],
        (_, result) => console.log(`Deleted ${result.rowsAffected} messages from ${tableName}`),
        (_, error) => { throw error; }
      )
    );
    console.log(`Messages for peerId ${peerId} deleted successfully`);
    return true;
  } catch (error) {
    console.error(`Error deleting messages for peerId ${peerId}:`, error);
    return false;
  }
};

export const formatTime = (timestamp: number) => {//TODO: check timestamp handling across different timezones
    const date = new Date(timestamp);
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    return `${day}/${month} ${hours}:${minutes}`;
};

export default () => null;