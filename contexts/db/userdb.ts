import SQLite from 'react-native-sqlite-storage';

export type User = {
  peerId: string;
  name: string | null;
  publicKey: string;
  aesKey?: string;
  iv?: string;
  profilePic?: string;
  keyId?: string;
};

export const user_db = SQLite.openDatabase({ name: 'user.db', location: 'default' });

export const setupUserDatabase = async () => {
  try {
    (await user_db).transaction(tx => {
      tx.executeSql(
        `CREATE TABLE IF NOT EXISTS users (
          peerId TEXT PRIMARY KEY,
          name TEXT,
          publicKey TEXT,
          aesKey TEXT,
          iv TEXT,
          keyId TEXT,
          profilePic TEXT
        )`,
        [],
        () => console.log('Users table created or exists'),
        (_, error) => { throw error; }
      );
    });

    // Add aesKey column if missing
    (await user_db).transaction(tx =>
      tx.executeSql(
        `ALTER TABLE users ADD COLUMN aesKey TEXT`,
        [],
        () => console.log('Added aesKey column'),
        (_, error) => {
          if (error.message.includes('duplicate column name')) {
            return true; // Column already exists
          }
          throw error;
        }
      )
    );

    // Add iv column if missing
    (await user_db).transaction(tx =>
      tx.executeSql(
        `ALTER TABLE users ADD COLUMN iv TEXT`,
        [],
        () => console.log('Added iv column'),
        (_, error) => {
          if (error.message.includes('duplicate column name')) {
            return true; // Column already exists
          }
          throw error;
        }
      )
    );
    // Run migration to add keyId if missing
    (await user_db).transaction(tx =>
      tx.executeSql(
        `ALTER TABLE users ADD COLUMN keyId TEXT`,
        [],
        () => console.log('Added keyId column'),
        (_, error) => {
          if (error.message.includes('duplicate column name')) return true;
          throw error;
        }
      )
    );
  } catch (error) {
    console.error('Error setting up users table:', error);
    throw error;
  }
};

export const updateUser = async (
  peerId: string,
  updates: Partial<Pick<User, 'aesKey' | 'iv' | 'keyId'>>
): Promise<boolean> => {
  try {
    const { aesKey, iv, keyId } = updates;
    const result = await new Promise<number>(async (resolve, reject) => {
      (await user_db).transaction(tx =>
        tx.executeSql(
          `UPDATE users SET aesKey = ?, iv = ?, keyId = ? WHERE peerId = ?`,
          [aesKey || '', iv || '', keyId || '', peerId],
          (_, { rowsAffected }) => resolve(rowsAffected),
          (_, error) => reject(error)
        )
      );
    });

    console.log(`Updated user ${peerId}, rows affected: ${result}`);
    if (result === 0) {
      console.warn(`No user found with peerId ${peerId} to update`);
    }
    return result > 0;
  } catch (error) {
    console.error(`Error updating user ${peerId}:`, error);
    throw error;
  }
};

export const dropUsersDB = async (): Promise<boolean> => {
  try {
    const result = await new Promise<boolean>(async (resolve, reject) => {
      (await user_db).transaction(tx => {
        tx.executeSql(
          `DROP TABLE IF EXISTS users`,
          [],
          () => resolve(true),
          (_, error) => reject(error)
        );
      });
    });
    console.log('Users table dropped successfully');
    return result;
  } catch (error) {
    console.error('Error dropping users table:', error);
    return false;
  }
};

export const saveUserToDB = async (user: User) => {
  try {
    (await user_db).transaction(tx =>
      tx.executeSql(
        `INSERT OR REPLACE INTO users (peerId, name, publicKey, aesKey, iv, keyId, profilePic) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          user.peerId,
          user.name,
          user.publicKey,
          user.aesKey || '',
          user.iv || '',
          user.keyId || '',
          user.profilePic || '',
        ],
        (_, result) => console.log(`Inserted user ${user.peerId}, rows affected: ${result.rowsAffected}`),
        (_, error) => { throw error; }
      )
    );
  } catch (error) {
    console.error('Error inserting user:', error);
    throw error; // Propagate error to caller
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
    console.warn(`Error fetching user ${peerId}:`, error);
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