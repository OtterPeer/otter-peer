docker build -t custom-android-emulator .

docker run --privileged -d \
 -p 6080:6080 \
 --name android-container \
 -e DEVICE="Nexus 5" \
 -e APPIUM=true \
 -e NO_VNC=true \
 -v $(pwd)/app-release.apk:/root/app-release.apk \
 custom-android-emulator
