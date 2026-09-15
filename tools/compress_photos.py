#!/usr/bin/env python3
"""Устарело: оставлено для совместимости. Сжатие картинок теперь делает tools/optimize_images.py
(прогрессивный JPEG + WebP, ширины по фактическому показу). Этот файл просто вызывает его."""
import os, runpy, sys
sys.argv = [sys.argv[0]] + sys.argv[1:]
runpy.run_path(os.path.join(os.path.dirname(__file__), "optimize_images.py"), run_name="__main__")
