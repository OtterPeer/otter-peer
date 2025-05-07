import SQLite from 'react-native-sqlite-storage';
 
export type User = {
  peerId: string;
  name: string | null;
  publicKey: string;
  aesKey?: string;
  iv?: string;
  profilePic?: string;
  keyId?: string;
  description?: string;
  sex?: number[];
  interests?: number[];
  searching?: number[];
  birthDay?: number;
  birthMonth?: number;
  birthYear?: number;
  x?: number;
  y?: number;
};
 
export const user_db = SQLite.openDatabase({ name: 'user.db', location: 'default' });
 
export const setupUserDatabase = async () => {
  try {
    (await user_db).transaction(tx => {
      // tx.executeSql(
      //   `DROP TABLE users`,
      //   [],
      //   () => console.log('deleted'),
      //   (_, error) => { throw error; }
      // );
 
      tx.executeSql(
        `CREATE TABLE IF NOT EXISTS users (
          peerId TEXT PRIMARY KEY,
          name TEXT,
          publicKey TEXT,
          aesKey TEXT,
          iv TEXT,
          keyId TEXT,
          profilePic TEXT,
          description TEXT,
          sex TEXT,
          interests TEXT,
          searching TEXT,
          birthDay INTEGER,
          birthMonth INTEGER,
          birthYear INTEGER,
          x REAL,
          y REAL
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
  updates: Partial<Omit<User, 'peerId' | 'publicKey'>>
): Promise<boolean> => {
  try {
    const {
      name,
      aesKey,
      iv,
      keyId,
      profilePic,
      description,
      sex,
      interests,
      searching,
      birthDay,
      birthMonth,
      birthYear,
      x,
      y
    } = updates;

    // Prepare SQL update fields and values
    const fields: string[] = [];
    const values: any[] = [];

    if (name !== undefined) {
      fields.push('name = ?');
      values.push(name);
    }
    if (aesKey !== undefined) {
      fields.push('aesKey = ?');
      values.push(aesKey || '');
    }
    if (iv !== undefined) {
      fields.push('iv = ?');
      values.push(iv || '');
    }
    if (keyId !== undefined) {
      fields.push('keyId = ?');
      values.push(keyId || '');
    }
    if (profilePic !== undefined) {
      fields.push('profilePic = ?');
      values.push(profilePic || '');
    }
    if (description !== undefined) {
      fields.push('description = ?');
      values.push(description || '');
    }
    if (sex !== undefined) {
      fields.push('sex = ?');
      values.push(sex ? JSON.stringify(sex) : '[]');
    }
    if (interests !== undefined) {
      fields.push('interests = ?');
      values.push(interests ? JSON.stringify(interests) : '[]');
      console.log(JSON.stringify(interests));
    }
    if (searching !== undefined) {
      fields.push('searching = ?');
      values.push(searching ? JSON.stringify(searching) : '[]');
    }
    if (birthDay !== undefined) {
      fields.push('birthDay = ?');
      values.push(birthDay || null);
    }
    if (birthMonth !== undefined) {
      fields.push('birthMonth = ?');
      values.push(birthMonth || null);
    }
    if (birthYear !== undefined) {
      fields.push('birthYear = ?');
      values.push(birthYear || null);
    }
    if (x !== undefined) {
      fields.push('x = ?');
      values.push(x || null);
    }
    if (y !== undefined) {
      fields.push('y = ?');
      values.push(y || null);
    }

    if (fields.length === 0) {
      console.warn('No fields to update');
      return false;
    }

    const query = `UPDATE users SET ${fields.join(', ')} WHERE peerId = ?`;
    values.push(peerId);

    const result = await new Promise<number>(async (resolve, reject) => {
      (await user_db).transaction(tx =>
        tx.executeSql(
          query,
          values,
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
    const sexSerialized = user.sex ? JSON.stringify(user.sex) : '[]';
    const interestsSerialized = user.interests ? JSON.stringify(user.interests) : '[]';
    const searchingSerialized = user.searching ? JSON.stringify(user.searching) : '[]';
 
    (await user_db).transaction(tx =>
      tx.executeSql(
        `INSERT OR REPLACE INTO users (peerId, name, publicKey, aesKey, iv, keyId, profilePic, description, sex, interests, searching, birthDay, birthMonth, birthYear, x, y) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          user.peerId,
          user.name,
          user.publicKey,
          user.aesKey || '',
          user.iv || '',
          user.keyId || '',
          user.profilePic || '',
          user.description ?? '',
          sexSerialized,
          interestsSerialized,
          searchingSerialized,
          user.birthDay || null,
          user.birthMonth || null,
          user.birthYear || null,
          user.x || null,
          user.y || null
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