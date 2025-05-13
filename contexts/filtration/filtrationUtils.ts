import { searchingOptions } from "@/constants/SearchingOptions";
import { UserFilter } from "@/types/types";
import AsyncStorage from "@react-native-async-storage/async-storage";

export const loadUserFiltration = async (): Promise<UserFilter> => {
  try {
    const storedFiltration = await AsyncStorage.getItem('userFiltration');
    if (storedFiltration) {
      const filtration: UserFilter = JSON.parse(storedFiltration);
      return {
        selectedSex: filtration.selectedSex ?? new Array(3).fill(0),
        selectedSearching: filtration.selectedSearching ?? new Array(searchingOptions.length).fill(0),
        distanceRange: filtration.distanceRange ?? 50,
        ageRange: filtration.ageRange ?? [18, 80],
      };
    }

    return {
      selectedSex: new Array(3).fill(0),
      selectedSearching: new Array(searchingOptions.length).fill(0),
      distanceRange: 50,
      ageRange: [18, 80],
    };
  } catch (error) {
    console.error('Error loading filtration from AsyncStorage:', error);
    return {
      selectedSex: new Array(3).fill(0),
      selectedSearching: new Array(searchingOptions.length).fill(0),
      distanceRange: 50,
      ageRange: [18, 80],
    };
  }
};

export const saveFiltration = async (selectedSex:number[], distanceRange:number, ageRange:[number, number], selectedSearching:number[]) => {
  try {
    const filtration: UserFilter = {
      selectedSex: selectedSex,
      distanceRange: distanceRange,
      ageRange: ageRange,
      selectedSearching: selectedSearching,
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