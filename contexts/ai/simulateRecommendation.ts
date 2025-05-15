// // Definicje interfejsów

// // Użytkownik w danych treningowych
// interface UserData {
//     idPeer: string;
//     x: number;
//     y: number;
//     label: string; // "Zainteresowanie" lub "Brak zainteresowania"
// }

// // Użytkownik w all_peers (bez etykiety)
// interface Peer {
//     idPeer: string;
//     x: number;
//     y: number;
// }

// // Nowy użytkownik do predykcji
// interface NewUser {
//     idPeer: string;
//     x: number;
//     y: number;
// }

// // Wynik predykcji
// interface PredictedUser {
//     idPeer: string;
//     x: number;
//     y: number;
//     label: string;
//     scores: { [key: string]: number };
// }

// // Model KNN
// interface KNNModel {
//     trainingData: UserData[];
// }

// // Historia swipe'ów
// interface Swipe {
//     idPeer: string;
//     label: string; // "Zainteresowanie" lub "Brak zainteresowania"
// }

// // Funkcja trainModel – przechowuje dane treningowe
// function trainModel(data: UserData[]): KNNModel {
//     if (data.length === 0) throw new Error("Training data cannot be empty");

//     const labelCounts = data.reduce((acc, user) => {
//         acc[user.label] = (acc[user.label] || 0) + 1;
//         return acc;
//     }, {} as { [key: string]: number });
//     if (Object.keys(labelCounts).length < 2) {
//         console.warn("Dane treningowe są jednostronne – zawierają tylko jedną etykietę:", labelCounts);
//     }

//     return { trainingData: data };
// }

// // Funkcja predictModel – klasyfikuje nowego użytkownika
// function predictModel(model: KNNModel, newUser: NewUser): PredictedUser {
//     const { idPeer, x: newX, y: newY } = newUser;
//     const trainingData = model.trainingData;

//     const distances = trainingData.map((user) => {
//         const distance = Math.sqrt(
//             Math.pow(user.x - newX, 2) + Math.pow(user.y - newY, 2)
//         );
//         return { user, distance };
//     });

//     distances.sort((a, b) => a.distance - b.distance);
//     const kNearest = distances.slice(0, 5);

//     const epsilon = 0.0001;
//     const weights = kNearest.map((neighbor) => ({
//         label: neighbor.user.label,
//         weight: 1 / (neighbor.distance + epsilon),
//     }));

//     const weightSums = weights.reduce(
//         (acc, { label, weight }) => {
//             acc[label] = (acc[label] || 0) + weight;
//             return acc;
//         },
//         {} as { [key: string]: number }
//     );

//     const totalWeight = Object.values(weightSums).reduce((sum, w) => sum + w, 0);
//     const scores: { [key: string]: number } = {
//         Zainteresowanie: 0,
//         "Brak zainteresowania": 0,
//     };

//     if (weightSums["Zainteresowanie"]) {
//         scores["Zainteresowanie"] = parseFloat(
//             (weightSums["Zainteresowanie"] / totalWeight).toFixed(4)
//         );
//     }
//     if (weightSums["Brak zainteresowania"]) {
//         scores["Brak zainteresowania"] = parseFloat(
//             (weightSums["Brak zainteresowania"] / totalWeight).toFixed(4)
//         );
//     }

//     const predictedLabel =
//         scores["Zainteresowanie"] >= scores["Brak zainteresowania"]
//             ? "Zainteresowanie"
//             : "Brak zainteresowania";

//     return {
//         idPeer,
//         x: newX,
//         y: newY,
//         label: predictedLabel,
//         scores,
//     };
// }

// // Funkcja generująca losowe współrzędne
// function generateRandomPeer(id: string): Peer {
//     return {
//         idPeer: id,
//         x: Math.random() * 3,
//         y: Math.random() * 3,
//     };
// }

// // Funkcja generująca początkową listę 40 losowych użytkowników
// function getInitialRecommendationList(allPeers: Peer[]): PredictedUser[] {
//     const shuffled = allPeers.sort(() => 0.5 - Math.random());
//     const initialList = shuffled.slice(0, Math.min(40, allPeers.length));
//     return initialList.map((peer) => ({
//         ...peer,
//         label: "", // Początkowo bez etykiety
//         scores: { Zainteresowanie: 0, "Brak zainteresowania": 0 },
//     }));
// }

// // Funkcja klasyfikująca wszystkich użytkowników
// function classifyAllPeers(model: KNNModel, allPeers: Peer[]): PredictedUser[] {
//     return allPeers.map((peer) => predictModel(model, peer));
// }

// // Funkcja generująca listę rekomendacji (9+1)
// function generateRecommendationList(
//     classifiedPeers: PredictedUser[],
//     recentlySwipedQueue: string[]
// ): PredictedUser[] {
//     const availablePeers = classifiedPeers.filter(
//         (peer) => !recentlySwipedQueue.includes(peer.idPeer)
//     );
//     if (availablePeers.length < 20) {
//         throw new Error("Za mało dostępnych użytkowników – minimum 20 wymagane");
//     }

//     const recommended: PredictedUser[] = [];
//     let remainingPeers = [...availablePeers].sort(
//         (a, b) => (b.scores["Zainteresowanie"] || 0) - (a.scores["Zainteresowanie"] || 0)
//     );

//     while (recommended.length < 40 && remainingPeers.length > 0) {
//         const groupSize = Math.min(10, remainingPeers.length);
//         const top9 = remainingPeers.slice(0, 9);
//         const bottom1 = remainingPeers.slice(-1);

//         recommended.push(...top9, ...bottom1);
//         remainingPeers = remainingPeers.slice(9 + 1);
//     }

//     // Jeśli mniej niż 40, bierzemy wszystkich dostępnych
//     return recommended.slice(0, Math.min(40, availablePeers.length));
// }

// // Funkcja generująca dane treningowe z swipe'ów
// function generateTrainingData(swipeHistory: Swipe[], allPeers: Peer[]): UserData[] {
//     return swipeHistory.map((swipe) => {
//         const peer = allPeers.find((p) => p.idPeer === swipe.idPeer);
//         if (!peer) throw new Error(`Peer ${swipe.idPeer} nie znaleziony`);
//         return { ...peer, label: swipe.label };
//     });
// }

// /*// Główna funkcja symulująca mechanizm
// function simulateRecommendationSystem(): void {
//     // 1. Generowanie all_peers (200 użytkowników)
//     const allPeers: Peer[] = Array.from({ length: 200 }, (_, i) =>
//         generateRandomPeer(`peer${i + 1}`)
//     );
//     console.log("Liczba początkowych peerów:", allPeers.length);

//     // 2. Początkowa lista 40 losowych użytkowników
//     let recommendationList = getInitialRecommendationList(allPeers);
//     console.log("Początkowa lista 40 użytkowników:", recommendationList.slice(0, 5), "...");

//     // 3. Symulacja 20 swipe'ów
//     const swipeHistory: Swipe[] = [];
//     const recentlySwipedQueue: string[] = [];
//     for (let i = 0; i < 20; i++) {
//         const swipe = recommendationList[i];
//         const label = Math.random() < 0.6 ? "Zainteresowanie" : "Brak zainteresowania"; // 60% prawy swipe
//         swipeHistory.push({ idPeer: swipe.idPeer, label });
//         recentlySwipedQueue.push(swipe.idPeer);
//         if (recentlySwipedQueue.length > 100) recentlySwipedQueue.shift();
//     }
//     console.log("Liczba swipe'ów:", swipeHistory.length);
//     console.log("Przykładowe swipe'y:", swipeHistory.slice(0, 5), "...");
//     console.log("Liczba użytkowników w kolejce:", recentlySwipedQueue.length);

//     // 4. Generowanie danych treningowych i aktualizacja modelu
//     const trainingData = generateTrainingData(swipeHistory, allPeers);
//     const model = trainModel(trainingData);
//     console.log("Dane treningowe:", trainingData);

//     // 5. Klasyfikacja wszystkich peerów
//     const classifiedPeers = classifyAllPeers(model, allPeers);
//     console.log("Przykładowi sklasyfikowani użytkownicy (10):", classifiedPeers.slice(0, 10), "...");

//     // 6. Generowanie nowej listy rekomendacji
//     const newRecommendationList = generateRecommendationList(classifiedPeers, recentlySwipedQueue);
//     console.log("Nowa lista rekomendacji (40 lub wszystkich dostępnych):", newRecommendationList.slice(0, 5), "...");
//     console.log("Liczba użytkowników w nowej liście:", newRecommendationList.length);
// }*/

// function simulateRecommendationSystem(): void {
//     const allPeers: Peer[] = Array.from({ length: 200 }, (_, i) =>
//         generateRandomPeer(`peer${i + 1}`)
//     );
//     console.log("Liczba początkowych peerów:", allPeers.length);

//     let recommendationList = getInitialRecommendationList(allPeers);
//     console.log("Początkowa lista 40 użytkowników:", recommendationList.slice(0, 5), "...");

//     const swipeHistory: Swipe[] = [];
//     const recentlySwipedQueue: string[] = [];

//     // Cykl 1
//     console.log("\n=== Cykl 1 ===");
//     for (let i = 0; i < 20; i++) {
//         const swipe = recommendationList[i];
//         const label = Math.random() < 0.6 ? "Zainteresowanie" : "Brak zainteresowania";
//         swipeHistory.push({ idPeer: swipe.idPeer, label });
//         recentlySwipedQueue.push(swipe.idPeer);
//         if (recentlySwipedQueue.length > 100) recentlySwipedQueue.shift();
//     }
//     console.log("Liczba swipe'ów:", swipeHistory.length);
//     console.log("Przykładowe swipe'y:", swipeHistory.slice(0, 5), "...");
//     console.log("Liczba użytkowników w kolejce:", recentlySwipedQueue.length);

//     let trainingData = generateTrainingData(swipeHistory, allPeers);
//     let model = trainModel(trainingData);
//     console.log("Dane treningowe:", trainingData);

//     let classifiedPeers = classifyAllPeers(model, allPeers);
//     console.log("Przykładowi sklasyfikowani użytkownicy (10):", classifiedPeers.slice(0, 10), "...");

//     recommendationList = generateRecommendationList(classifiedPeers, recentlySwipedQueue);
//     console.log("Nowa lista rekomendacji:", recommendationList.slice(0, 5), "...");
//     console.log("Liczba użytkowników w nowej liście:", recommendationList.length);

//     // Cykl 2
//     console.log("\n=== Cykl 2 ===");
//     swipeHistory.length = 0;
//     for (let i = 0; i < 20; i++) {
//         const swipe = recommendationList[i];
//         const label = Math.random() < 0.6 ? "Zainteresowanie" : "Brak zainteresowania";
//         swipeHistory.push({ idPeer: swipe.idPeer, label });
//         recentlySwipedQueue.push(swipe.idPeer);
//         if (recentlySwipedQueue.length > 100) recentlySwipedQueue.shift();
//     }
//     console.log("Liczba swipe'ów:", swipeHistory.length);
//     console.log("Przykładowe swipe'y:", swipeHistory.slice(0, 5), "...");
//     console.log("Liczba użytkowników w kolejce:", recentlySwipedQueue.length);

//     trainingData = generateTrainingData(swipeHistory, allPeers);
//     model = trainModel(trainingData);
//     console.log("Dane treningowe:", trainingData);

//     classifiedPeers = classifyAllPeers(model, allPeers);
//     console.log("Przykładowi sklasyfikowani użytkownicy (10):", classifiedPeers.slice(0, 10), "...");

//     recommendationList = generateRecommendationList(classifiedPeers, recentlySwipedQueue);
//     console.log("Nowa lista rekomendacji:", recommendationList.slice(0, 5), "...");
//     console.log("Liczba użytkowników w nowej liście:", recommendationList.length);

//     // Cykl 3
//     console.log("\n=== Cykl 3 ===");
//     swipeHistory.length = 0;
//     for (let i = 0; i < 20; i++) {
//         const swipe = recommendationList[i];
//         const label = Math.random() < 0.6 ? "Zainteresowanie" : "Brak zainteresowania";
//         swipeHistory.push({ idPeer: swipe.idPeer, label });
//         recentlySwipedQueue.push(swipe.idPeer);
//         if (recentlySwipedQueue.length > 100) recentlySwipedQueue.shift();
//     }
//     console.log("Liczba swipe'ów:", swipeHistory.length);
//     console.log("Przykładowe swipe'y:", swipeHistory.slice(0, 5), "...");
//     console.log("Liczba użytkowników w kolejce:", recentlySwipedQueue.length);

//     trainingData = generateTrainingData(swipeHistory, allPeers);
//     model = trainModel(trainingData);
//     console.log("Dane treningowe:", trainingData);

//     classifiedPeers = classifyAllPeers(model, allPeers);
//     console.log("Przykładowi sklasyfikowani użytkownicy (10):", classifiedPeers.slice(0, 10), "...");

//     recommendationList = generateRecommendationList(classifiedPeers, recentlySwipedQueue);
//     console.log("Nowa lista rekomendacji:", recommendationList.slice(0, 5), "...");
//     console.log("Liczba użytkowników w nowej liście:", recommendationList.length);

//     // Cykl 4
//     console.log("\n=== Cykl 4 ===");
//     swipeHistory.length = 0;
//     for (let i = 0; i < 20; i++) {
//         const swipe = recommendationList[i];
//         const label = Math.random() < 0.6 ? "Zainteresowanie" : "Brak zainteresowania";
//         swipeHistory.push({ idPeer: swipe.idPeer, label });
//         recentlySwipedQueue.push(swipe.idPeer);
//         if (recentlySwipedQueue.length > 100) recentlySwipedQueue.shift();
//     }
//     console.log("Liczba swipe'ów:", swipeHistory.length);
//     console.log("Przykładowe swipe'y:", swipeHistory.slice(0, 5), "...");
//     console.log("Liczba użytkowników w kolejce:", recentlySwipedQueue.length);

//     trainingData = generateTrainingData(swipeHistory, allPeers);
//     model = trainModel(trainingData);
//     console.log("Dane treningowe:", trainingData);

//     classifiedPeers = classifyAllPeers(model, allPeers);
//     console.log("Przykładowi sklasyfikowani użytkownicy (10):", classifiedPeers.slice(0, 10), "...");

//     recommendationList = generateRecommendationList(classifiedPeers, recentlySwipedQueue);
//     console.log("Nowa lista rekomendacji:", recommendationList.slice(0, 5), "...");
//     console.log("Liczba użytkowników w nowej liście:", recommendationList.length);

//     // Cykl 5
//     console.log("\n=== Cykl 5 ===");
//     swipeHistory.length = 0;
//     for (let i = 0; i < 20; i++) {
//         const swipe = recommendationList[i];
//         const label = Math.random() < 0.6 ? "Zainteresowanie" : "Brak zainteresowania";
//         swipeHistory.push({ idPeer: swipe.idPeer, label });
//         recentlySwipedQueue.push(swipe.idPeer);
//         if (recentlySwipedQueue.length > 100) recentlySwipedQueue.shift();
//     }
//     console.log("Liczba swipe'ów:", swipeHistory.length);
//     console.log("Przykładowe swipe'y:", swipeHistory.slice(0, 5), "...");
//     console.log("Liczba użytkowników w kolejce:", recentlySwipedQueue.length);

//     trainingData = generateTrainingData(swipeHistory, allPeers);
//     model = trainModel(trainingData);
//     console.log("Dane treningowe:", trainingData);

//     classifiedPeers = classifyAllPeers(model, allPeers);
//     console.log("Przykładowi sklasyfikowani użytkownicy (10):", classifiedPeers.slice(0, 10), "...");

//     recommendationList = generateRecommendationList(classifiedPeers, recentlySwipedQueue);
//     console.log("Nowa lista rekomendacji:", recommendationList.slice(0, 5), "...");
//     console.log("Liczba użytkowników w nowej liście:", recommendationList.length);

//     // Cykl 6
//     console.log("\n=== Cykl 6 ===");
//     swipeHistory.length = 0;
//     for (let i = 0; i < 20; i++) {
//         const swipe = recommendationList[i];
//         const label = Math.random() < 0.6 ? "Zainteresowanie" : "Brak zainteresowania";
//         swipeHistory.push({ idPeer: swipe.idPeer, label });
//         recentlySwipedQueue.push(swipe.idPeer);
//         if (recentlySwipedQueue.length > 100) recentlySwipedQueue.shift();
//     }
//     console.log("Liczba swipe'ów:", swipeHistory.length);
//     console.log("Przykładowe swipe'y:", swipeHistory.slice(0, 5), "...");
//     console.log("Liczba użytkowników w kolejce:", recentlySwipedQueue.length);

//     trainingData = generateTrainingData(swipeHistory, allPeers);
//     model = trainModel(trainingData);
//     console.log("Dane treningowe:", trainingData);

//     classifiedPeers = classifyAllPeers(model, allPeers);
//     console.log("Przykładowi sklasyfikowani użytkownicy (10):", classifiedPeers.slice(0, 10), "...");

//     recommendationList = generateRecommendationList(classifiedPeers, recentlySwipedQueue);
//     console.log("Nowa lista rekomendacji:", recommendationList.slice(0, 5), "...");
//     console.log("Liczba użytkowników w nowej liście:", recommendationList.length);
// }

// // Uruchomienie symulacji
// simulateRecommendationSystem();