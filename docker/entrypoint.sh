# entrypoint.sh
#!/bin/bash
# Copy the user profile JSON to the emulator's SD card
adb wait-for-device
adb push /root/userProfile.json /sdcard/userProfile.json

# Start the original entrypoint process
exec "$@"
