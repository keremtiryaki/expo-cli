# Expo CLI

Tools for making Expo apps.

- [Documentation](https://docs.expo.io/versions/latest/workflow/expo-cli)
- [Contributing to Expo CLI](https://github.com/expo/expo-cli/blob/master/CONTRIBUTING.md)


### update and run locally for ci builds
```
update code from packages/expo-cli/src/commands/build/AndroidBuilder.js

then run this command

yarn run bootstrap

then use builded version via 
/usr/local/opt/node@10/bin/node /Users/k/Desktop/Projects/EPOS/public/expo-cli/packages/expo-cli/bin/expo.js


and add
echo "alias expo='/usr/local/opt/node@10/bin/node /Users/k/Desktop/Projects/EPOS/public/expo-cli/packages/expo-cli/bin/expo.js'" >> ~/.bash_profile
```