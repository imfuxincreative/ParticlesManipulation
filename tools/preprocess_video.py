#!/usr/bin/env python
import os
import sys
import argparse

def install_dependencies():
    print("Checking Python dependencies...")
    try:
        import cv2
        import torch
        import numpy
        import timm
        print("All dependencies are already installed.")
    except ImportError as e:
        missing_module = str(e).split("'")[-2] if "'" in str(e) else str(e)
        print(f"Missing dependency: {missing_module}")
        print("Installing required modules: opencv-python torch torchvision numpy timm...")
        import subprocess
        try:
            subprocess.check_call([sys.executable, "-m", "pip", "install", "opencv-python", "torch", "torchvision", "numpy", "timm"])
            print("Successfully installed dependencies!")
        except Exception as ex:
            print(f"Error installing dependencies: {ex}")
            print("Please run manually: pip install opencv-python torch torchvision numpy timm")
            sys.exit(1)

# Ensure dependencies are available
install_dependencies()

import cv2
import numpy as np
import torch

def preprocess(input_path, output_path, model_type="dpt_beit_large_512", target_height=540):
    """
    Reads input video, runs MiDaS depth estimation on each frame,
    and writes a side-by-side RGB-D video (Left: Color, Right: Depth).
    """
    print(f"Loading MiDaS model '{model_type}' from Torch Hub...")
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"Using device: {device}")
    
    try:
        midas = torch.hub.load("intel-isl/MiDaS", model_type)
        midas.to(device)
        midas.eval()
    except Exception as e:
        print(f"Error loading model {model_type}: {e}")
        print("Trying fallback model 'MiDaS_small'...")
        try:
            model_type = "MiDaS_small"
            midas = torch.hub.load("intel-isl/MiDaS", model_type)
            midas.to(device)
            midas.eval()
        except Exception as ex:
            print(f"Failed to load fallback model: {ex}")
            sys.exit(1)

    # Load appropriate transforms based on model
    print("Loading transform...")
    midas_transforms = torch.hub.load("intel-isl/MiDaS", "transforms")
    if model_type in ["dpt_beit_large_512", "dpt_swin2_large_384", "dpt_large_384", "dpt_hybrid_384"]:
        transform = midas_transforms.dpt_transform
    else:
        transform = midas_transforms.small_transform

    # Open video
    cap = cv2.VideoCapture(input_path)
    if not cap.isOpened():
        print(f"Error: Could not open input video '{input_path}'")
        sys.exit(1)

    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    fps = cap.get(cv2.CAP_PROP_FPS)
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    
    print(f"Input Video Details: {width}x{height} @ {fps}fps, Total frames: {total_frames}")

    # Calculate dimensions
    # For performance and loading speeds on web, downscale height to target_height (default: 540px)
    # Output width is (target_width * 2) to fit Color and Depth side-by-side.
    aspect_ratio = width / height
    color_width = int(target_height * aspect_ratio)
    
    # Let's make color_width even to avoid issues
    if color_width % 2 != 0:
        color_width += 1
        
    out_width = color_width * 2
    out_height = target_height

    print(f"Output Video Details: {out_width}x{out_height} (Each side: {color_width}x{out_height})")

    # Define video writer
    fourcc = cv2.VideoWriter_fourcc(*'mp4v') # Codec for mp4
    out = cv2.VideoWriter(output_path, fourcc, fps, (out_width, out_height))

    frame_count = 0
    with torch.no_grad():
        while cap.isOpened():
            ret, frame = cap.read()
            if not ret:
                break

            # Frame is BGR from OpenCV, convert to RGB
            img = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            
            # Apply input transform
            input_batch = transform(img).to(device)

            # Predict depth
            prediction = midas(input_batch)

            # Resize depth to original size for scaling
            prediction = torch.nn.functional.interpolate(
                prediction.unsqueeze(1),
                size=img.shape[:2],
                mode="bicubic",
                align_corners=False,
            ).squeeze()

            depth_map = prediction.cpu().numpy()

            # Normalize depth to 0-255
            depth_min = depth_map.min()
            depth_max = depth_map.max()
            if depth_max > depth_min:
                depth_norm = (depth_map - depth_min) / (depth_max - depth_min)
            else:
                depth_norm = np.zeros_like(depth_map)
                
            depth_norm = (depth_norm * 255).astype(np.uint8)

            # Resize both color frame and depth map to target dimensions
            resized_color = cv2.resize(frame, (color_width, out_height))
            resized_depth = cv2.resize(depth_norm, (color_width, out_height))

            # Convert depth map back to 3 channels so we can concatenate
            depth_3ch = cv2.cvtColor(resized_depth, cv2.COLOR_GRAY2BGR)

            # Stack horizontally: [Color | Depth]
            combined_frame = np.hstack((resized_color, depth_3ch))

            # Write frame
            out.write(combined_frame)

            frame_count += 1
            if frame_count % 10 == 0 or frame_count == total_frames:
                progress = (frame_count / total_frames) * 100
                print(f"Processed frame {frame_count}/{total_frames} ({progress:.1f}%)")

    cap.release()
    out.release()
    print(f"Processing complete! Output saved to: {output_path}")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Preprocess video for RGB-D 3D Particle effect")
    parser.add_argument("--input", required=True, help="Path to input source video (mp4, mov, etc)")
    parser.add_argument("--output", required=True, help="Path to save output RGB-D video")
    parser.add_argument("--model", default="dpt_beit_large_512", choices=[
        "dpt_beit_large_512", "dpt_swin2_large_384", "dpt_large_384", "dpt_hybrid_384", "MiDaS_small"
    ], help="MiDaS model type")
    parser.add_argument("--height", type=int, default=540, help="Output target height (width will be proportional)")

    args = parser.parse_args()
    preprocess(args.input, args.output, args.model, args.height)
