import * as tf from '@tensorflow/tfjs'
import { bundleResourceIO } from '@tensorflow/tfjs-react-native'

import modelJSON from './model.json';
import modelWeights from './group1-shard.bin';


// Custom L2 Regularizer class
class L2Regularizer extends tf.serialization.Serializable {
  l2: number;
  constructor(config: { l2: number; }) {
    super();
    this.l2 = config.l2 || 0.001;
  }

  apply(x: any) {
    return tf.mul(this.l2, tf.sum(tf.square(x)));
  }

  getConfig() {
    return { l2: this.l2 };
  }

  static get className() {
    return 'L2';
  }

  static fromConfig(cls: new (arg0: any) => any, config: any) {
    return new cls(config);
  }
}

tf.serialization.registerClass(L2Regularizer);

export type BooleanArray46 = (0 | 1)[] & { length: 46 };

export class EncoderModel {
  private model: tf.LayersModel | null;

  constructor() {
    this.model = null;
  }

  async initialize(): Promise<void> {
    try {
      await tf.ready();
      await tf.setBackend('cpu');

      this.model = await tf.loadLayersModel(
        bundleResourceIO(modelJSON as tf.io.ModelJSON, modelWeights)
      );
      console.log('EncoderModel initialized successfully');
    } catch (error) {
      console.error('[EncoderModel INITIALIZATION ERROR]', error);
      throw new Error(`Failed to initialize EncoderModel: ${(error as Error).message}`);
    }
  }

  async predict(inputArray: BooleanArray46): Promise<[number, number]> {
    if (!this.model) {
      throw new Error('Model not initialized. Call initialize() first.');
    }

    try {
      if (!Array.isArray(inputArray) || inputArray.length !== 46) {
        throw new Error('Input must be a 46-element array');
      }
      if (!inputArray.every((val): val is 0 | 1 => val === 0 || val === 1)) {
        throw new Error('Input array must contain only 0 or 1 values');
      }

      const inputTensor = tf.tensor2d([inputArray], [1, 46], 'float32');

      const prediction = this.model.predict(inputTensor) as tf.Tensor;

      const output = await prediction.data();

      inputTensor.dispose();
      prediction.dispose();

      return [output[0], output[1]];
    } catch (error) {
      console.error('[EncoderModel PREDICTION ERROR]', error);
      throw new Error(`Prediction failed: ${(error as Error).message}`);
    }
  }

  dispose(): void {
    if (this.model) {
      this.model.dispose();
      this.model = null;
      console.log('EncoderModel disposed');
    }
  }
}

export default EncoderModel;