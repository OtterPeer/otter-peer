import SQLite from 'react-native-sqlite-storage';

export type User = {
  peerId: string;
  name: string;
  publicKey: string;
  profilePic?: string;
};

export const user_db = SQLite.openDatabase({ name: 'user.db', location: 'default' });

export const setupUserDatabase = async () => {
  try {
    (await user_db).transaction(tx =>
      tx.executeSql(
        `CREATE TABLE IF NOT EXISTS users (
          peerId TEXT PRIMARY KEY,
          name TEXT,
          publicKey TEXT,
          profilePic TEXT
        )`,
        [],
        () => console.log('Users table created or exists'),
        (_, error) => { throw error; }
      )
    );
  } catch (error) {
    console.error('Error creating users table:', error);
  }
};

export const saveUserToDB = async (user: User) => {
  try {
    (await user_db).transaction(tx =>
      tx.executeSql(
        `INSERT OR REPLACE INTO users (peerId, name, publicKey, profilePic) VALUES (?, ?, ?, ?)`,
        [user.peerId, user.name, user.publicKey, user.profilePic || ''],
        (_, result) => console.log(`Inserted user ${user.peerId}, rows affected: ${result.rowsAffected}`),
        (_, error) => { throw error; }
      )
    );
  } catch (error) {
    console.error('Error inserting user:', error);
  }
};

export const fetchUserFromDB = async (peerId: string): Promise<User | null> => {
  try {
    const results = await new Promise<User | null>(async (resolve, reject) => {
      (await user_db).transaction(tx => {
        tx.executeSql(
          `SELECT * FROM users WHERE peerId = ?`,
          [peerId],
          (_, { rows }) => resolve(rows.length > 0 ? rows.item(0) as User : null),
          (_, error) => reject(error)
        );
      });
    });
    return results;
  } catch (error) {
    console.error(`Error fetching user ${peerId}:`, error);
    return null;
  }
};

export const fetchAllUsersFromDB = async (): Promise<User[]> => {
  try {
    const results = await new Promise<User[]>(async (resolve, reject) => {
      (await user_db).transaction(tx => {
        tx.executeSql(
          `SELECT * FROM users`,
          [],
          (_, { rows }) => resolve(rows.raw() as User[]),
          (_, error) => reject(error)
        );
      });
    });
    return results;
  } catch (error) {
    console.error('Error fetching all users:', error);
    return [];
  }
};

export default () => null;