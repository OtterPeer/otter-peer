import { SwipeLabel } from "@/types/types";

// Nowy użytkownik do predykcji
interface NewUser {
  x: number;
  y: number;
}

// Wynik predykcji
interface PredictedLabel {
  label: 'right' | 'left';
  scores: { 'right': number, 'left': number };
}

// Model KNN
interface KNNModel {
  trainingData: SwipeLabel[];
}

const K = 3;

// Funkcja trainModel – przechowuje dane treningowe
export function trainModel(data: SwipeLabel[]): KNNModel {
  if (data.length === 0) throw new Error("Training data cannot be empty");
  if (data.length < K) throw new Error(`Training data have to be larger than ${K}`);

  // Sprawdzenie jednostronności danych
  const labelCounts = data.reduce((acc, user) => {
    acc[user.label] = (acc[user.label] || 0) + 1;
    return acc;
  }, {} as { [key: string]: number });
  if (Object.keys(labelCounts).length < 2) {
    console.warn("Dane treningowe są jednostronne – zawierają tylko jedną etykietę:", labelCounts);
  }

  return { trainingData: data };
}

// Funkcja predictModel – klasyfikuje nowego użytkownika
export function predictModel(model: KNNModel, userToClassify: NewUser): PredictedLabel {
  const { x: newX, y: newY } = userToClassify;
  const trainingData = model.trainingData;

  // 1. Obliczenie odległości euklidesowych
  const distances = trainingData.map((user) => {
    const distance = Math.sqrt(
      Math.pow(user.x - newX, 2) + Math.pow(user.y - newY, 2)
    );
    return { user, distance };
  });

  // 2. Sortowanie i wybór K najbliższych sąsiadów
  distances.sort((a, b) => a.distance - b.distance);
  const kNearest = distances.slice(0, K);

  // 3. Obliczenie wag (odwrotność odległości z epsilon)
  const epsilon = 0.0001;
  const weights = kNearest.map((neighbor) => ({
    label: neighbor.user.label,
    weight: 1 / (neighbor.distance + epsilon),
  }));

  // 4. Sumowanie wag dla każdej etykiety
  const weightSums = weights.reduce(
    (acc, { label, weight }) => {
      acc[label] = (acc[label] || 0) + weight;
      return acc;
    },
    {} as { [key: string]: number }
  );

  // 5. Obliczenie procentowego score
  const totalWeight = Object.values(weightSums).reduce((sum, w) => sum + w, 0);
  const scores = {
    'right': 0,
    'left': 0,
  };

  // Inicjalizacja score dla obu etykiet
  if (weightSums["right"]) {
    scores["right"] = parseFloat(
      (weightSums["right"] / totalWeight).toFixed(4)
    );
  }
  if (weightSums["left"]) {
    scores["left"] = parseFloat(
      (weightSums["left"] / totalWeight).toFixed(4)
    );
  }

  // 6. Przypisanie etykiety na podstawie większego score
  const predictedLabel =
    scores["right"] >= scores["left"]
      ? "right"
      : "left";

  // 7. Zwrot wyniku
  return {
    label: predictedLabel,
    scores,
  };
}

// Testowanie
// const model = trainModel(trainingData);

// // Test 1:
// const newUser1: NewUser = { idPeer: "newPeer1", x: 0.9, y: 0.9 };
// const predictedUser1 = predictModel(model, newUser1);
// console.log("Test 1 – Użytkownik blisko klastra 'Zainteresowanie':", predictedUser1);

// // Test 2:
// const newUser2: NewUser = { idPeer: "newPeer2", x: -1.8, y: 0.8 };
// const predictedUser2 = predictModel(model, newUser2);
// console.log("Test 2 – Użytkownik blisko klastra 'Brak zainteresowania':", predictedUser2);

// // Test 3:
// const newUser3: NewUser = { idPeer: "newPeer3", x: 0.7, y: -2.0 };
// const predictedUser3 = predictModel(model, newUser3);
// console.log("Test 3 – Użytkownik w środku między klastrami:", predictedUser3);