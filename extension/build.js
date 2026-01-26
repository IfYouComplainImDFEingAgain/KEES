const esbuild = require('esbuild');
const path = require('path');

const isWatch = process.argv.includes('--watch');

const buildOptions = {
    entryPoints: [path.join(__dirname, 'src/chat-content.js')],
    bundle: true,
    outfile: path.join(__dirname, 'dist/chat-content.js'),
    format: 'iife',
    target: ['chrome90', 'firefox90'],
    minify: false,
    sourcemap: false,
    logLevel: 'info'
};

async function build() {
    try {
        if (isWatch) {
            const ctx = await esbuild.context(buildOptions);
            await ctx.watch();
            console.log('Watching for changes...');
        } else {
            await esbuild.build(buildOptions);
            console.log('Build complete!');
        }
    } catch (error) {
        console.error('Build failed:', error);
        process.exit(1);
    }
}

build();
