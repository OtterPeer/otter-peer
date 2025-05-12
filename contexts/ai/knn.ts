// Dane użytkownika w danych treningowych
interface UserData {
    idPeer: string;
    x: number;
    y: number;
    label: string;
}

// Nowy użytkownik do predykcji
interface NewUser {
    idPeer: string;
    x: number;
    y: number;
}

// Wynik predykcji
interface PredictedUser {
    idPeer: string;
    x: number;
    y: number;
    label: string;
    scores: { [key: string]: number };
}

// Model KNN
interface KNNModel {
    trainingData: UserData[];
}

// Hardkodowane dane treningowe
const trainingData: UserData[] = [
    { idPeer: "peer1", x: 1.2, y: 1.4, label: "Zainteresowanie" },
    { idPeer: "peer2", x: 1.5, y: 1.8, label: "Brak zainteresowania" },
    { idPeer: "peer3", x: 0.8, y: 0.1, label: "Zainteresowanie" },
    { idPeer: "peer4", x: 1.0, y: 0.5, label: "Brak zainteresowania" },
    { idPeer: "peer5", x: 0.5, y: 1.8, label: "Zainteresowanie" },
    { idPeer: "peer6", x: 0.2, y: 1.0, label: "Brak zainteresowania" },
    { idPeer: "peer7", x: 1.0, y: 1.0, label: "Zainteresowanie" },
    { idPeer: "peer8", x: 0.8, y: 0.7, label: "Brak zainteresowania" },
    { idPeer: "peer9", x: 1.3, y: 1.5, label: "Zainteresowanie" },
    { idPeer: "peer10", x: 1.7, y: 1.2, label: "Brak zainteresowania" },
    { idPeer: "peer11", x: 0.9, y: 0.2, label: "Zainteresowanie" },
    { idPeer: "peer12", x: 1.1, y: 0.4, label: "Brak zainteresowania" },
    { idPeer: "peer13", x: 1.4, y: 1.9, label: "Zainteresowanie" },
    { idPeer: "peer14", x: 0.3, y: 0.9, label: "Brak zainteresowania" },
    { idPeer: "peer15", x: 1.1, y: 1.1, label: "Zainteresowanie" },
    { idPeer: "peer16", x: 1.9, y: 0.6, label: "Brak zainteresowania" },
    { idPeer: "peer17", x: 1.6, y: 1.7, label: "Zainteresowanie" },
    { idPeer: "peer18", x: 1.4, y: 1.1, label: "Brak zainteresowania" },
    { idPeer: "peer19", x: 1.7, y: 0.6, label: "Zainteresowanie" },
    { idPeer: "peer20", x: 1.6, y: 1.3, label: "Brak zainteresowania" },
];

// Funkcja trainModel – przechowuje dane treningowe
function trainModel(data: UserData[]): KNNModel {
    if (data.length === 0) throw new Error("Training data cannot be empty");

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
function predictModel(model: KNNModel, newUser: NewUser): PredictedUser {
    const { idPeer, x: newX, y: newY } = newUser;
    const trainingData = model.trainingData;

    // 1. Obliczenie odległości euklidesowych
    const distances = trainingData.map((user) => {
        const distance = Math.sqrt(
            Math.pow(user.x - newX, 2) + Math.pow(user.y - newY, 2)
        );
        return { user, distance };
    });

    // 2. Sortowanie i wybór 5 najbliższych sąsiadów
    distances.sort((a, b) => a.distance - b.distance);
    const kNearest = distances.slice(0, 5);

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
    const scores: { [key: string]: number } = {
        Zainteresowanie: 0,
        "Brak zainteresowania": 0,
    };

    // Inicjalizacja score dla obu etykiet
    if (weightSums["Zainteresowanie"]) {
        scores["Zainteresowanie"] = parseFloat(
            (weightSums["Zainteresowanie"] / totalWeight).toFixed(4)
        );
    }
    if (weightSums["Brak zainteresowania"]) {
        scores["Brak zainteresowania"] = parseFloat(
            (weightSums["Brak zainteresowania"] / totalWeight).toFixed(4)
        );
    }

    // 6. Przypisanie etykiety na podstawie większego score
    const predictedLabel =
        scores["Zainteresowanie"] >= scores["Brak zainteresowania"]
            ? "Zainteresowanie"
            : "Brak zainteresowania";

    // 7. Zwrot wyniku
    return {
        idPeer,
        x: newX,
        y: newY,
        label: predictedLabel,
        scores,
    };
}

// Testowanie
const model = trainModel(trainingData);

// Test 1:
const newUser1: NewUser = { idPeer: "newPeer1", x: 0.9, y: 0.9 };
const predictedUser1 = predictModel(model, newUser1);
console.log("Test 1 – Użytkownik blisko klastra 'Zainteresowanie':", predictedUser1);

// Test 2:
const newUser2: NewUser = { idPeer: "newPeer2", x: -1.8, y: 0.8 };
const predictedUser2 = predictModel(model, newUser2);
console.log("Test 2 – Użytkownik blisko klastra 'Brak zainteresowania':", predictedUser2);

// Test 3:
const newUser3: NewUser = { idPeer: "newPeer3", x: 0.7, y: -2.0 };
const predictedUser3 = predictModel(model, newUser3);
console.log("Test 3 – Użytkownik w środku między klastrami:", predictedUser3);