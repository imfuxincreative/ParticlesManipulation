#!/usr/bin/env python
import os
import sys
import numpy as np

def install_dependencies():
    try:
        import cv2
    except ImportError:
        print("Installing opencv-python for video generation...")
        import subprocess
        subprocess.check_call([sys.executable, "-m", "pip", "install", "opencv-python"])

install_dependencies()
import cv2

def generate_video(output_path="public/particles_rgbd.mp4", num_frames=150, width=640, height=360):
    half_width = width // 2
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    
    # We use mp4v codec for standard MP4 writing
    fourcc = cv2.VideoWriter_fourcc(*'mp4v')
    out = cv2.VideoWriter(output_path, fourcc, 30.0, (width, height))
    
    print(f"Generating {num_frames} frames of synthetic mountain terrain...")
    
    # Cache meshgrid for vectorized computations (speedup)
    y_coords, x_coords = np.mgrid[0:height, 0:half_width]
    ny = y_coords / height
    nx = x_coords / half_width

    for f in range(num_frames):
        t = f / num_frames
        
        # Create rolling mountain center coordinates
        peak_x = 0.5 + 0.15 * np.sin(t * np.pi * 2)
        peak_y = 0.4 + 0.10 * np.cos(t * np.pi * 2)
        
        # Standard Gaussian mountain shape
        dist_sq = (nx - peak_x)**2 + (ny - peak_y)**2
        height_val = np.exp(-4.5 * dist_sq) * 0.75
        
        # Add high-frequency terrain ripples
        ripple = 0.12 * np.sin(nx * 24 + t * np.pi * 2.5) * np.cos(ny * 16 + t * np.pi * 1.5)
        # Fade ripples near edges
        ripple_fade = (1.0 - np.clip(dist_sq * 2, 0.0, 1.0))
        
        final_height = np.clip(height_val + ripple * ripple_fade, 0.0, 1.0)
        
        # Depth Map (grayscale)
        depth_map = (final_height * 255).astype(np.uint8)
        depth_map_blurred = cv2.GaussianBlur(depth_map, (15, 15), 0)
        depth_3ch = cv2.cvtColor(depth_map_blurred, cv2.COLOR_GRAY2BGR)
        
        # Color Map (BGR colors for OpenCV)
        # Low levels = deep blue/indigo, mid levels = emerald green, peaks = pale yellow/white
        r = (final_height * 220 + (1.0 - final_height) * 10).astype(np.uint8)
        g = (final_height * 240 + (1.0 - final_height) * 15).astype(np.uint8)
        b = (final_height * 140 + (1.0 - final_height) * 45).astype(np.uint8)
        
        color_frame = np.stack((b, g, r), axis=-1)
        
        # Horizontal stack: Left (Color), Right (Depth)
        combined_frame = np.hstack((color_frame, depth_3ch))
        out.write(combined_frame)
        
        if (f + 1) % 30 == 0 or (f + 1) == num_frames:
            print(f"Generated frame {f + 1}/{num_frames}")
            
    out.release()
    print(f"Successfully generated synthetic video at: {output_path}")

if __name__ == "__main__":
    output = "public/particles_rgbd.mp4"
    if len(sys.argv) > 1:
        output = sys.argv[1]
    generate_video(output)
