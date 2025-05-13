import React, { useRef, useState } from 'react';
import { View, Text, StyleSheet, View as RNView, Platform } from 'react-native';
import { Colors } from '@/constants/Colors';
import { Fonts } from '@/constants/Fonts';
import { useColorScheme } from '@/hooks/useColorScheme';
import MultiSlider from '@ptomasroos/react-native-multi-slider';

interface SliderOtterProps {
  title?: string;
  subtitle?: string;
  value: number | [number, number];
  onChange: (value: number | [number, number]) => void;
  minValue?: number;
  maxValue?: number;
  step?: number;
  rangeBetween?: boolean;
  onSlidingStart?: () => void;
  onSlidingComplete?: () => void;
}

export default function SliderOtter({
  title,
  subtitle,
  value,
  onChange,
  minValue = 0,
  maxValue = 100,
  step = 1,
  rangeBetween = false,
  onSlidingStart,
  onSlidingComplete,
}: SliderOtterProps): JSX.Element {
  const colorScheme = useColorScheme();
  const styles = getStyles(colorScheme ?? 'light');

  // Initialize tempValue with the initial value
  const [tempValue, setTempValue] = useState<number | [number, number]>(value);
  const sliderRef = useRef<RNView>(null);
  const [sliderWidth, setSliderWidth] = useState(0);

  // Sync tempValue with prop changes
  React.useEffect(() => {
    setTempValue(value);
  }, [value]);

  const handleLayout = () => {
    if (sliderRef.current) {
      sliderRef.current.measure((x, y, width) => {
        setSliderWidth(width);
      });
    }
  };

  const getThumbPosition = (val: number, index: number) => {
    const range = maxValue - minValue;
    const fraction = (val - minValue) / range;
    let offset = 20;

    if (rangeBetween && Array.isArray(tempValue) && tempValue.length === 2) {
      const minVal = tempValue[0];
      const maxVal = tempValue[1];
      const minPos = sliderWidth * (minVal - minValue) / range;
      const maxPos = sliderWidth * (maxVal - minValue) / range;
      const distance = Math.abs(maxPos - minPos);
      if (distance < 40) {
        if (index === 0) {
          offset += 20;
        } else if (index === 1) {
          offset -= 20;
        }
      }
    }

    return sliderWidth * fraction - offset;
  };

  const handleValuesChange = (newValues: number[]) => {
    // Update tempValue for real-time UI feedback
    if (rangeBetween) {
      setTempValue([newValues[0], newValues[1]]);
    } else {
      setTempValue(newValues[0]);
    }
  };

  const handleValuesChangeFinish = (newValues: number[]) => {
    // Update parent state only when sliding is complete
    if (rangeBetween) {
      onChange([newValues[0], newValues[1]]);
    } else {
      onChange(newValues[0]);
    }
    onSlidingComplete?.();
  };

  const values = Array.isArray(tempValue) ? tempValue : [tempValue];

  return (
    <View style={styles.container}>
      {title && <Text style={styles.title}>{title}</Text>}
      {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
      <View
        style={styles.sliderContainer}
        ref={sliderRef}
        onLayout={handleLayout}
      >
        <View style={styles.sliderWrapper}>
          <MultiSlider
            values={values}
            onValuesChange={handleValuesChange}
            onValuesChangeStart={onSlidingStart}
            onValuesChangeFinish={handleValuesChangeFinish}
            min={minValue}
            max={maxValue}
            step={step}
            sliderLength={sliderWidth || 300}
            trackStyle={{
              height: 4,
              backgroundColor: Colors[colorScheme ?? 'light'].background3_50,
            }}
            selectedStyle={{
              backgroundColor: Colors[colorScheme ?? 'light'].accent,
            }}
            markerStyle={{
              height: 20,
              width: 20,
              borderRadius: 10,
              backgroundColor: Colors[colorScheme ?? 'light'].text,
              borderWidth: 6,
              borderColor: Colors[colorScheme ?? 'light'].accent,
            }}
            containerStyle={styles.slider}
          />
          {values.map((val, index) => (
            (!rangeBetween && index === 0) || rangeBetween ? (
              <Text
                key={index}
                style={[
                  styles.floatingValue,
                  { left: getThumbPosition(val, index) },
                ]}
              >
                {val}
              </Text>
            ) : null
          ))}
        </View>
      </View>
    </View>
  );
}

const getStyles = (colorScheme: 'light' | 'dark') =>
  StyleSheet.create({
    container: {
      width: '100%',
      marginBottom: 16,
    },
    title: {
      fontSize: 14,
      lineHeight: 14,
      fontFamily: Fonts.fontFamilyBold,
      textAlign: 'left',
      color: Colors[colorScheme].text,
      marginBottom: 8,
    },
    subtitle: {
      fontSize: 14,
      lineHeight: 14,
      fontFamily: Fonts.fontFamilyRegular,
      textAlign: 'left',
      color: Colors[colorScheme].text2_50,
      marginBottom: 32,
    },
    sliderContainer: {
      width: '90%',
      left: '5%',
      right: '5%',
      alignItems: 'center',
      paddingVertical: 0,
    },
    sliderWrapper: {
      position: 'relative',
      width: '100%',
    },
    slider: {
      width: '100%',
      height: 40,
    },
    floatingValue: {
      position: 'absolute',
      top: -24,
      fontSize: 12,
      fontFamily: Fonts.fontFamilyBold,
      color: Colors[colorScheme].text,
      backgroundColor: Colors[colorScheme].background1,
      paddingHorizontal: 6,
      paddingTop: Platform.OS === 'ios' ? 6 : 8,
      lineHeight: 12,
      height: 26,
      width: 40,
      borderRadius: 13,
      textAlign: 'center',
      borderWidth: 2,
      borderColor: Colors[colorScheme].accent,
    },
  });