const { execSync } = require('child_process');
const ffmpeg = require('ffmpeg-static');
const path = require('path');
const fs = require('fs');

const inputVideo = path.join(__dirname, 'public', 'demo.mp4');
const outputVideo = path.join(__dirname, 'public', 'demo_scrub.mp4');

console.log(`Using ffmpeg at: ${ffmpeg}`);
console.log(`Input: ${inputVideo}`);
console.log(`Output: ${outputVideo}`);

if (!fs.existsSync(inputVideo)) {
    console.error('Input video not found!');
    process.exit(1);
}

try {
    // Re-encode video with all intra-frames (keyframes only)
    // -g 1: Group of picture size 1 (every frame is an I-frame/keyframe)
    // -keyint_min 1: Minimum keyframe interval
    // -movflags +faststart: Places the moov atom at the beginning
    // -pix_fmt yuv420p: Standard pixel format for web compatibility
    // -preset fast: Balance between speed and compression
    // -crf 18: High quality
    // -an: Remove audio
    const cmd = `"${ffmpeg}" -y -i "${inputVideo}" -c:v libx264 -preset fast -crf 18 -g 1 -keyint_min 1 -pix_fmt yuv420p -movflags +faststart -an "${outputVideo}"`;
    
    console.log(`Running: ${cmd}`);
    execSync(cmd, { stdio: 'inherit' });
    console.log('Encoding complete!');
} catch (e) {
    console.error('Encoding failed:', e);
    process.exit(1);
}
