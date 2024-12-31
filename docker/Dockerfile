FROM budtmo/docker-android:emulator_14.0_v2.11.4-p0

# Copy the JSON file into the container
COPY userProfile.json /root/userProfile.json

# Copy the entrypoint script
COPY entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

# Set the custom entrypoint script
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
