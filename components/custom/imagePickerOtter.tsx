import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActionSheetIOS, Platform, Image } from 'react-native';
import { useColorScheme } from 'react-native';
import { Colors } from '@/constants/Colors';
import { Fonts } from '@/constants/Fonts';
import Modal from 'react-native-modal';
import ImagePicker from 'react-native-image-crop-picker';
import PencilIcon from '@/assets/icons/uicons/pencil.svg';
import { useTheme } from '@/contexts/themeContext';

interface ImagePickerProps {
  profilePic: string | null;
  onImageChange: (base64: string) => void;
}

const ImagePickerComponent: React.FC<ImagePickerProps> = ({ profilePic, onImageChange }) => {
    const { theme } = useTheme();
    const styles = getStyles(theme);
    const [profilePicTemp, setProfilePicTemp] = useState<string | null>(null);
    const [isModalVisible, setModalVisible] = useState(false);

    useEffect(() => {
        setProfilePicTemp(profilePic)
    }, []);

    const pickImage = async (useCamera: boolean): Promise<void> => {
        try {
          let image;
          if (useCamera) {
            image = await ImagePicker.openCamera({
                mediaType: 'photo',
                cropping: true,
                cropperCircleOverlay: false,
                width: 900,
                height: 1400,
                cropperAspectRatio: 9 / 14,
                includeBase64: true,
                includeExif: true,
                compressImageQuality: 0.5,
            });
          } else {
            image = await ImagePicker.openPicker({
                mediaType: 'photo',
                cropping: true,
                cropperCircleOverlay: false,
                width: 900,
                height: 1400,
                cropperAspectRatio: 9 / 14,
                includeBase64: true,
                includeExif: true,
                compressImageQuality: 0.5,
            });
          }

          console.log('EXIF Data:', image.exif || 'No EXIF data available');

          if (image.data) {
            const base64Image = `data:image/jpeg;base64,${image.data}`;
            setProfilePicTemp(base64Image);
            onImageChange(base64Image);
          }
        } catch (error) {
            console.log("Image picker error:", error);
        }
      };
      
    const showImagePickerOptions = () => {
    if (Platform.OS === 'ios') {
        ActionSheetIOS.showActionSheetWithOptions(
        {
            options: ['Anuluj', 'Zrób zdjęcie', 'Wybierz z Biblioteki'],
            cancelButtonIndex: 0,
        },
        (buttonIndex) => {
            if (buttonIndex === 1) {
                pickImage(true); // Camera
            } else if (buttonIndex === 2) {
                pickImage(false); // Library
            }
        }
        );
    } else {
        setModalVisible(true);
    }
    };

    return (
        <View style={styles.container}>
            {/* Modal for Android */}
              <Modal
                isVisible={isModalVisible && Platform.OS === 'android'}
                style={styles.modalContainer}
                onBackdropPress={() => setModalVisible(false)}
                onBackButtonPress={() => setModalVisible(false)}>
                <View style={styles.modalContent}>
                  <View style={styles.optionButtons}>
                    <TouchableOpacity
                      style={styles.optionButton}
                      onPress={() => {
                        setModalVisible(false);
                        pickImage(true); // Camera
                      }}>
                      <Text style={styles.optionText}>Zrób zdjęcie</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.optionButton2}
                      onPress={() => {
                        setModalVisible(false);
                        pickImage(false); // Library
                      }}>
                      <Text style={styles.optionText}>Wybierz z Biblioteki</Text>
                    </TouchableOpacity>
                  </View>
                  <TouchableOpacity
                    style={styles.cancelButton}
                    onPress={() => setModalVisible(false)}>
                    <Text style={styles.cancelText}>Anuluj</Text>
                  </TouchableOpacity>
                </View>
              </Modal>
            {/* Modal for Android */}
    
            <View style={styles.avatarContainer}>
              {profilePicTemp ? (
                <Image source={{ uri: profilePicTemp }} style={styles.avatarImage} />
              ) : (
                <View style={styles.avatarPlaceholder} />
              )}
              <TouchableOpacity
                onPress={showImagePickerOptions}
                style={styles.avatarButton}
                activeOpacity={0.7}>
                {profilePicTemp ? (
                  <PencilIcon height={20} width={20} fill={theme.icon} />
                ) : (
                  <Text style={styles.avatarButtonTitle}>+</Text>
                )}
              </TouchableOpacity>
            </View>
        </View>
    );
};

const getStyles = (theme: typeof Colors.light) =>
    StyleSheet.create({
    container: {
      width: '100%',
    },
    avatarContainer: {
      alignItems: 'center',
      borderRadius: 10,
    },
    avatarImage: {
      width: 200,
      height: 200,
      borderRadius: 100,
      marginBottom: -22,
      borderColor: theme.border1,
      borderWidth: 4,
    },
    avatarPlaceholder: {
      width: 200,
      height: 200,
      borderRadius: 100,
      backgroundColor: theme.background2,
      marginBottom: -22,
      borderColor: theme.border1,
      borderWidth: 4,
    },
    avatarButton: {
      width: 40,
      height: 40,
      backgroundColor: theme.accent,
      borderRadius: 20,
      borderWidth: 2,
      borderColor: theme.border1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    avatarButtonTitle: {
      fontSize: 36,
      fontFamily: Fonts.fontFamilyRegular,
      lineHeight: 38,
      color: theme.icon,
      textAlign: 'center',
      includeFontPadding: false,
    },
    modalContainer: {
      justifyContent: 'flex-end',
      margin: 0,
    },
      modalContent: {
      backgroundColor: 'transparent',
      padding: 20,
      alignItems: 'center',
    },
      optionButtons:{
      width: '100%',
      alignItems: 'center',
    },
    optionButton: {
      backgroundColor: theme.background2,
      borderTopRightRadius: 16,
      borderTopLeftRadius: 16,
      width: '100%',
      padding: 15,
      alignItems: 'center',
      borderBottomWidth: 2,
      borderColor: theme.border1,
    },
    optionButton2:{
      backgroundColor: theme.background2,
      borderBottomRightRadius: 16,
      borderBottomLeftRadius: 16,
      width: '100%',
      padding: 15,
      alignItems: 'center',
      marginBottom: 8,
    },
    optionText: {
      fontSize: 20,
      color: theme.text3_blue,
    },
    cancelButton: {
      backgroundColor: theme.background2,
      borderRadius: 16,
      width: '100%',
      padding: 15,
      alignItems: 'center',
    },
    cancelText: {
      fontSize: 20,
      color: theme.text3_blue,
      fontWeight: 'bold',
    },
    
});

export default ImagePickerComponent;