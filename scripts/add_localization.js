const fs = require('fs');
const path = require('path');

module.exports = function (context) {
    const projectRoot = context.opts.projectRoot;
    const iosDir = path.join(projectRoot, 'platforms', 'ios');

    if (!fs.existsSync(iosDir)) {
        return;
    }

    // Xcode project search karna
    const xcodeProjFiles = fs.readdirSync(iosDir).filter(f => f.endsWith('.xcodeproj'));
    if (!xcodeProjFiles.length) return;

    const pbxprojPath = path.join(iosDir, xcodeProjFiles[0], 'project.pbxproj');
    if (!fs.existsSync(pbxprojPath)) return;

    // OutSystems Main App folder find karna
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

    // 1. Files copy karna
    languages.forEach(lang => {
        const langDir = path.join(baseDir, `${lang}.lproj`);
        if (!fs.existsSync(langDir)) {
            fs.mkdirSync(langDir, { recursive: true });
        }

        const srcFile = path.join(context.opts.plugin.dir, 'Localisation', `${lang}.lproj`, 'InfoPlist.strings');
        const destFile = path.join(langDir, 'InfoPlist.strings');

        if (fs.existsSync(srcFile)) {
            fs.copyFileSync(srcFile, destFile);
            console.log(`[LocalizationHook] Copied ${srcFile} to ${destFile}`);
        }
    });

    // 2. Xcode project.pbxproj ko raw update karna
    let pbxContent = fs.readFileSync(pbxprojPath, 'utf8');

    // Known PBXVariantGroup for InfoPlist.strings check karein
    if (!pbxContent.includes('InfoPlist.strings in Resources')) {
        console.log('[LocalizationHook] Adding InfoPlist.strings references to Xcode project...');

        const buildFileId = 'A10000012800000000000001';
        const variantGroupId = 'A10000012800000000000002';
        const enFileId = 'A10000012800000000000003';
        const arFileId = 'A10000012800000000000004';

        // PBXBuildFile entry
        const buildFileEntry = `\t\t${buildFileId} /* InfoPlist.strings in Resources */ = {isa = PBXBuildFile; fileRef = ${variantGroupId} /* InfoPlist.strings */; };\n`;
        pbxContent = pbxContent.replace('/* Begin PBXBuildFile section */\n', '/* Begin PBXBuildFile section */\n' + buildFileEntry);

        // PBXFileReference entries
        const fileRefEntries =
            `\t\t${enFileId} /* en */ = {isa = PBXFileReference; lastKnownFileType = text.plist.strings; name = en; path = "${appFolder}/en.lproj/InfoPlist.strings"; sourceTree = "<group>"; };\n` +
            `\t\t${arFileId} /* ar */ = {isa = PBXFileReference; lastKnownFileType = text.plist.strings; name = ar; path = "${appFolder}/ar.lproj/InfoPlist.strings"; sourceTree = "<group>"; };\n`;
        pbxContent = pbxContent.replace('/* Begin PBXFileReference section */\n', '/* Begin PBXFileReference section */\n' + fileRefEntries);

        // PBXVariantGroup section
        const variantGroup =
            `\t\t${variantGroupId} /* InfoPlist.strings */ = {\n` +
            `\t\t\tisa = PBXVariantGroup;\n` +
            `\t\t\tchildren = (\n` +
            `\t\t\t\t${enFileId} /* en */,\n` +
            `\t\t\t\t${arFileId} /* ar */,\n` +
            `\t\t\t);\n` +
            `\t\t\tname = InfoPlist.strings;\n` +
            `\t\t\tsourceTree = "<group>";\n` +
            `\t\t};\n`;

        if (pbxContent.includes('/* Begin PBXVariantGroup section */')) {
            pbxContent = pbxContent.replace('/* Begin PBXVariantGroup section */\n', '/* Begin PBXVariantGroup section */\n' + variantGroup);
        } else {
            const variantSection = `/* Begin PBXVariantGroup section */\n${variantGroup}/* End PBXVariantGroup section */\n\n`;
            pbxContent = pbxContent.replace('/* Begin PBXNativeTarget section */', variantSection + '/* Begin PBXNativeTarget section */');
        }

        // Add to Resources Build Phase
        const resourcesRegex = /(\/\* Resources \*\/ = \{\s*isa = PBXResourcesBuildPhase;\s*buildActionMask = [0-9]+;\s*files = \()/;
        pbxContent = pbxContent.replace(resourcesRegex, `$1\n\t\t\t\t${buildFileId} /* InfoPlist.strings in Resources */,`);

        fs.writeFileSync(pbxprojPath, pbxContent, 'utf8');
        console.log('[LocalizationHook] Successfully patched project.pbxproj without external npm modules.');
    }
};
