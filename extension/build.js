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

// Forum content script (thread pages)
const forumBuildOptions = {
    entryPoints: [path.join(__dirname, 'src/forum-content.js')],
    bundle: true,
    outfile: path.join(__dirname, 'dist/forum-content.js'),
    format: 'iife',
    target: ['chrome90', 'firefox90'],
    minify: false,
    sourcemap: false,
    logLevel: 'info'
};

// Member content script (profile pages)
const memberBuildOptions = {
    entryPoints: [path.join(__dirname, 'src/member-content.js')],
    bundle: true,
    outfile: path.join(__dirname, 'dist/member-content.js'),
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
            const forumCtx = await esbuild.context(forumBuildOptions);
            const memberCtx = await esbuild.context(memberBuildOptions);
            await Promise.all([chatCtx.watch(), homepageCtx.watch(), forumCtx.watch(), memberCtx.watch()]);
            console.log('Watching for changes...');
        } else {
            await Promise.all([
                esbuild.build(chatBuildOptions),
                esbuild.build(homepageBuildOptions),
                esbuild.build(forumBuildOptions),
                esbuild.build(memberBuildOptions)
            ]);
            console.log('Build complete!');
        }
    } catch (error) {
        console.error('Build failed:', error);
        process.exit(1);
    }
}

build();
