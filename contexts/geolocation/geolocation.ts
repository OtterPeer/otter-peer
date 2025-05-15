import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Profile } from '@/types/types';
import { Alert } from 'react-native';

const INITIAL_SIDE_KM = 2

export const getExactLocation = async () => {
    let { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
        console.error('Permission to access location was denied');
        return null;
    }
    let loc = await Location.getCurrentPositionAsync({});
    const { latitude, longitude } = loc.coords;
    return { latitude, longitude };
};

export const getDummyLocation = async () => {
    const exactLoc = await getExactLocation();
    if (exactLoc == null) {
        return { latitude: null, longitude: null };
    }
    const { latitude, longitude } = exactLoc;
    const privateKey = await getGeoPrivateKey();
    const { longitude: dummyLon, latitude: dummyLat } = dummyLocation(longitude, latitude, privateKey, INITIAL_SIDE_KM);
    return { latitude: dummyLat, longitude: dummyLon };
};

export const updateGeolocationProfile = async () => {
    const storedProfile = await AsyncStorage.getItem('userProfile');
    const currentProfile: Profile = storedProfile ? JSON.parse(storedProfile) : {};
    const dummyLocResult = await getDummyLocation();
    const { latitude, longitude } = dummyLocResult;
    if (latitude == null && longitude == null){
        Alert.alert('🦦', 'Problem z pobraniem geolokacji, aplikacja musi uywać Twojej lokalizacji do działania');
        return
    }
    console.log(latitude);
    console.log(longitude);
    const updatedProfile: Profile = {
    ...currentProfile,
    ...(latitude !== null && { latitude: latitude }),
    ...(longitude !== null && { longitude: longitude }),
    };
    console.log("UpdateGEO latitude", latitude)
    console.log("UpdateGEO longitude", longitude)
    return await AsyncStorage.setItem('userProfile', JSON.stringify(updatedProfile));
}

export const seedRandom = (seed: number) => {
    const x = Math.sin(seed) * 10000;
    return () => {
        const nextSeed = (x * seed) % 1000000;
        seed = nextSeed;
        return nextSeed / 1000000;
    };
};

export const generatePrivateKey = async () => {
    const privateKey = Math.floor(Math.random() * 10**18).toString();
    await AsyncStorage.setItem('geoPrivateKey', privateKey);
    return privateKey;
};

export const getGeoPrivateKey = async () => {
    let privateKey = await AsyncStorage.getItem('geoPrivateKey');
    if (!privateKey) {
        const existingKey = await AsyncStorage.getItem('geoPrivateKey');
        if (!existingKey) {
            privateKey = await generatePrivateKey();
        } else {
            privateKey = existingKey;
        }
    }
    return parseInt(privateKey);
};

export const deleteGeoPrivateKey  = async () => {
    return await AsyncStorage.removeItem('geoPrivateKey');
}

export const privateKeyToOffset = (privateKey: number, maxOffsetKm: number) => {
    const seed = privateKey % 1000000;
    const random = seedRandom(seed);
    const randomOffsetDistance = Math.floor(random() * (maxOffsetKm - 1)) + 1;
    const kmToDeg = 1 / 111.32;
    const xOffset = (random() * 2 - 1) * maxOffsetKm * randomOffsetDistance * kmToDeg;
    const yOffset = (random() * 2 - 1) * maxOffsetKm * randomOffsetDistance * kmToDeg;
    return { xOffset, yOffset };
};

export const randomPointInSquare = (currentLon: number, currentLat: number, sideKm: number) => {
    const kmToDeg = 1 / 111.32;
    const xOffset = (Math.random() * 2 - 1) * sideKm * kmToDeg;
    const yOffset = (Math.random() * 2 - 1) * sideKm * kmToDeg;
    return { longitude: currentLon + xOffset, latitude: currentLat + yOffset };
};

export const dummyLocation = (trueLon: number, trueLat: number, privateKey: number, initialSideKm: number) => {
    const { xOffset, yOffset } = privateKeyToOffset(privateKey, initialSideKm);
    const currentLon = trueLon + xOffset;
    const currentLat = trueLat + yOffset;
    const { longitude, latitude } = randomPointInSquare(currentLon, currentLat, initialSideKm);
    return { longitude, latitude };
};

export const calculateGeoDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c;
    return distance;
};

const toRad = (value: number) => {
    return value * Math.PI / 180;
};