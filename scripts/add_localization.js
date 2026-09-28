const fs = require('fs');
const path = require('path');

module.exports = function (context) {
    const projectRoot = context.opts.projectRoot;
    const iosDir = path.join(projectRoot, 'platforms', 'ios');

    if (!fs.existsSync(iosDir)) {
        return;
    }

    const xcode = context.requireCordovaModule ? context.requireCordovaModule('xcode') : require('xcode');
    
    // Find .xcodeproj
    const xcodeProjFiles = fs.readdirSync(iosDir).filter(f => f.endsWith('.xcodeproj'));
    if (!xcodeProjFiles.length) return;

    const projPath = path.join(iosDir, xcodeProjFiles[0], 'project.pbxproj');
    const myProj = xcode.project(projPath);

    myProj.parseSync();

    // OutSystems Main App Folder find karna
    const items = fs.readdirSync(iosDir);
    let appFolder = items.find(item => {
        const fullPath = path.join(iosDir, item);
        return fs.statSync(fullPath).isDirectory() &&
               !item.endsWith('.xcodeproj') &&
               !item.endsWith('.xcworkspace') &&
               item !== 'build' &&
               item !== 'CordovaLib';
    });

    if (!appFolder) return;

    const baseDir = path.join(iosDir, appFolder);
    const languages = ['en', 'ar'];

    languages.forEach(lang => {
        const langDir = path.join(baseDir, `${lang}.lproj`);
        if (!fs.existsSync(langDir)) {
            fs.mkdirSync(langDir, { recursive: true });
        }

        const srcFile = path.join(context.opts.plugin.dir, 'Localisation', `${lang}.lproj`, 'InfoPlist.strings');
        const destFile = path.join(langDir, 'InfoPlist.strings');

        if (fs.existsSync(srcFile)) {
            fs.copyFileSync(srcFile, destFile);
        }

        // Relative path for Xcode
        const relPath = `${appFolder}/${lang}.lproj/InfoPlist.strings`;
        
        // Add to Xcode Copy Bundle Resources
        myProj.addResourceFile(relPath, { target: myProj.getFirstTarget().uuid });
    });

    // Write back to project.pbxproj
    fs.writeFileSync(projPath, myProj.writeSync());
    console.log('[Localization] Successfully registered InfoPlist.strings into Xcode target.');
};
