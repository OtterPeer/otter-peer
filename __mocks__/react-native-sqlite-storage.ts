export default {
     openDatabase: jest.fn(() => ({
       transaction: jest.fn((callback) => {
         callback({
           executeSql: jest.fn((sql, params, success) => {
             success(null, { rows: { raw: () => [], length: 0 } });
           }),
         });
       }),
       close: jest.fn(),
     })),
   };