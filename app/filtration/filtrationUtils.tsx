import { userFiltration } from "@/types/types";
import AsyncStorage from "@react-native-async-storage/async-storage";

export const getUserFiltration = async () => {
  try {
    const storedFiltration = await AsyncStorage.getItem('userFiltration');
    if (storedFiltration) {
      const filtration: userFiltration = JSON.parse(storedFiltration);
      console.log(filtration)
      return filtration
    }
    return storedFiltration
  } catch (error) {
    console.error('Error loading filtration from AsyncStorage:', error);
  }
};

export const saveFiltration = async (selectedSex:number[], distanceRange:number, ageRange:number[], selectedSearching:number[]) => {
  try {
    const filtration: userFiltration = {
      sex: selectedSex,
      distance: distanceRange,
      age: ageRange,
      searching: selectedSearching,
    };
    await AsyncStorage.setItem('userFiltration', JSON.stringify(filtration));
  } catch (error) {
    console.error('Error saving filtration to AsyncStorage:', error);
  }
};

export const removeFiltration = async () => {
  try {
    await AsyncStorage.removeItem('userFiltration');
  } catch (error) {
    console.error('Error saving filtration to AsyncStorage:', error);
  }
};