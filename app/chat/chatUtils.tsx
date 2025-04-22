import SQLite from 'react-native-sqlite-storage';

export type Message = {
  id: string;
  timestamp: number;
  senderId: string;
  destinationId: string;
  message: string;
};

export const chatHistory_db = SQLite.openDatabase({ name: 'chatHistory.db', location: 'default' });

export const setupDatabase = async (peerId: string) => {
    const sanitizedPeerId = peerId.replace(/[^a-zA-Z0-9]/g, '_');
    const tableName = `chat_${sanitizedPeerId}`;
    try {
      (await chatHistory_db).transaction(tx =>
        tx.executeSql(
          `CREATE TABLE IF NOT EXISTS ${tableName} (
            id TEXT PRIMARY KEY,
            timestamp INTEGER,
            senderId TEXT,
            destinationId TEXT,
            message TEXT
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

export const printMessagesFromPeer = (peerId: string, amount: number) => {
    const sanitizedPeerId = peerId.replace(/[^a-zA-Z0-9]/g, '_');
    const tableName = `chat_${sanitizedPeerId}`;
    try {
    const results =  new Promise(async (resolve, reject) => {
        (await chatHistory_db).transaction(tx => {
        tx.executeSql(
            `SELECT * FROM ${tableName}`,
            [],
            (_, { rows }) => {
            console.log(`Messages in ${tableName}:`);
            for (let i = 0; i < amount; i++) {
                console.log(rows.item(i));
            }
            },
            (_, error) => reject(error)
        );
        });
    });
    console.log(`Messages in ${tableName}:`, results);
    } catch (error) {
    console.error('Error querying database:', error);
    }
};
  
export const printMessagesToConsole = async () => {
    try {
    (await chatHistory_db).transaction(tx => {
        tx.executeSql(
        "SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'chat_%'",
        [],
        (_, { rows }) => {
            const tables = rows.raw();
            console.log("Tables found in chatHistory.db:", tables);
            tables.forEach(table => {
            const tableName = table.name;
            console.log(`\nFetching contents of table: ${tableName}`);
            tx.executeSql(
                `SELECT * FROM ${tableName}`,
                [],
                (_, { rows }) => {
                console.log(`Messages in ${tableName}:`);
                for (let i = 0; i < rows.length; i++) {
                    console.log(rows.item(i));
                }
                },
                (_, error) => {
                console.error(`Error querying table ${tableName}:`, error);
                }
            );
            });
        },
        (_, error) => {
            console.error("Error querying sqlite_master:", error);
        }
        );
    });
    } catch (error) {
    console.error("Error in printMessagesToConsole:", error);
    }
};

export const saveMessageToDB = async (messageData: Message, chatPeerId:string) => {
    const sanitizedPeerId = chatPeerId.replace(/[^a-zA-Z0-9]/g, '_');
    const tableName = `chat_${sanitizedPeerId}`;
    try {
      (await chatHistory_db).transaction(tx =>
        tx.executeSql(
          `INSERT INTO ${tableName} (id, timestamp, senderId, destinationId, message) VALUES (?, ?, ?, ?, ?)`,
          [messageData.id, messageData.timestamp, messageData.senderId, messageData.destinationId, messageData.message],
          (_, result) => console.log(`Inserted into ${tableName}, rows affected: ${result.rowsAffected}`),
          (_, error) => { throw error; }
        )
      );
    } catch (error) {
      console.error('Error inserting message:', error);
    }
};

export const fetchMessagesFromDB = async (peerId: string, amount: number): Promise<Message[]> => {
    const sanitizedPeerId = peerId.replace(/[^a-zA-Z0-9]/g, '_');
    const tableName = `chat_${sanitizedPeerId}`;
    try {
      const results = await new Promise<Message[]>(async (resolve, reject) => {
        (await chatHistory_db).transaction(tx => {
          tx.executeSql(
            `SELECT * FROM ${tableName} ORDER BY timestamp DESC LIMIT ?`,
            [amount],
            (_, { rows }) => resolve(rows.raw() as Message[]),
            (_, error) => reject(error)
          );
        });
      });
      return results;
    } catch (error) {
      console.error(`Error fetching messages from ${tableName}:`, error);
      return [];
    }
};

export const formatTime = (timestamp: number) => {
    const now = Date.now();
    const date = new Date(timestamp);
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    return `${day}/${month} ${hours}:${minutes}`;
};

export default () => null;