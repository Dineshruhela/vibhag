#!/bin/zsh
# Set Java 17 for React Native/Expo Android builds on macOS

# Install Java 17 if not already installed
brew install openjdk@17

# Add Java 17 to your shell profile
if ! grep -q 'export JAVA_HOME=$(/usr/libexec/java_home -v 17)' ~/.zshrc; then
  echo 'export JAVA_HOME=$(/usr/libexec/java_home -v 17)' >> ~/.zshrc
  echo 'export PATH="$JAVA_HOME/bin:$PATH"' >> ~/.zshrc
fi

# Reload shell config
echo "Reloading ~/.zshrc..."
source ~/.zshrc

# Show Java version
java -version

echo "Cleaning Android build..."
cd android && ./gradlew clean && cd ..

echo "Ready! Now run: npx expo run:android"
