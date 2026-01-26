const esbuild = require('esbuild');
const path = require('path');

const isWatch = process.argv.includes('--watch');

// Chat content script (full features)
const chatBuildOptions = {
    entryPoints: [path.join(__dirname, 'src/chat-content.js')],
    bundle: true,
    outfile: path.join(__dirname, 'dist/chat-content.js'),
    format: 'iife',
    target: ['chrome90', 'firefox90'],
    minify: false,
    sourcemap: false,
    logLevel: 'info'
};

// Homepage content script (lightweight)
const homepageBuildOptions = {
    entryPoints: [path.join(__dirname, 'src/homepage-content.js')],
    bundle: true,
    outfile: path.join(__dirname, 'dist/homepage-content.js'),
    format: 'iife',
    target: ['chrome90', 'firefox90'],
    minify: false,
    sourcemap: false,
    logLevel: 'info'
};

async function build() {
    try {
        if (isWatch) {
            const chatCtx = await esbuild.context(chatBuildOptions);
            const homepageCtx = await esbuild.context(homepageBuildOptions);
            await Promise.all([chatCtx.watch(), homepageCtx.watch()]);
            console.log('Watching for changes...');
        } else {
            await Promise.all([
                esbuild.build(chatBuildOptions),
                esbuild.build(homepageBuildOptions)
            ]);
            console.log('Build complete!');
        }
    } catch (error) {
        console.error('Build failed:', error);
        process.exit(1);
    }
}

build();
