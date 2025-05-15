let store: { [key: string]: string } = {};

const mockAsyncStorage = {
    getItem: jest.fn(async (key: string) => store[key] || null),
    setItem: jest.fn(async (key: string, value: string) => {
        store[key] = value;
    }),
    removeItem: jest.fn(async (key: string) => {
        delete store[key];
    }),
    clear: jest.fn(async () => {
        store = {};
    }),
    getAllKeys: jest.fn(async () => Object.keys(store)),
    multiGet: jest.fn(async (keys: string[]) =>
        keys.map(key => [key, store[key] || null])
    ),
    multiSet: jest.fn(async (keyValuePairs: [string, string][]) => {
        keyValuePairs.forEach(([key, value]) => {
            store[key] = value;
        });
    }),
    multiRemove: jest.fn(async (keys: string[]) => {
        keys.forEach(key => {
            delete store[key];
        });
    }),
};

export default mockAsyncStorage;