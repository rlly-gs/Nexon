//! Finds the dominant hues of an image (used to tint the holographic foil).

use std::path::Path;

const BINS: usize = 36; // 10° per bin
const MAX_HUES: usize = 3;
const MIN_SEPARATION: f32 = 40.0;

fn rgb_to_hsl(r: u8, g: u8, b: u8) -> (f32, f32, f32) {
    let (r, g, b) = (r as f32 / 255.0, g as f32 / 255.0, b as f32 / 255.0);
    let max = r.max(g).max(b);
    let min = r.min(g).min(b);
    let l = (max + min) / 2.0;
    let d = max - min;
    if d < f32::EPSILON {
        return (0.0, 0.0, l);
    }
    let s = d / (1.0 - (2.0 * l - 1.0).abs());
    let h = if max == r {
        60.0 * (((g - b) / d).rem_euclid(6.0))
    } else if max == g {
        60.0 * ((b - r) / d + 2.0)
    } else {
        60.0 * ((r - g) / d + 4.0)
    };
    (h, s, l)
}

fn hue_distance(a: f32, b: f32) -> f32 {
    let d = (a - b).abs() % 360.0;
    d.min(360.0 - d)
}

/// Up to three well-separated dominant hues, most prominent first.
/// Returns `Some(vec![])` for images without meaningful color (grayscale, very dark…).
pub fn dominant_hues(path: &Path) -> Option<Vec<f32>> {
    let img = image::open(path).ok()?.thumbnail(64, 64).to_rgb8();
    let pixels = (img.width() * img.height()).max(1) as f32;

    // Weighted hue histogram; also keep the weighted hue sum per bin for a precise average.
    let mut weight = [0f32; BINS];
    let mut hue_sum = [0f32; BINS];
    for p in img.pixels() {
        let [r, g, b] = p.0;
        let (h, s, l) = rgb_to_hsl(r, g, b);
        if s < 0.18 || !(0.12..=0.9).contains(&l) {
            continue; // grays, near-black and near-white don't say much about the art
        }
        // Favor saturated, mid-lightness pixels.
        let w = s * (1.0 - (l - 0.5).abs() * 1.4).max(0.1);
        let bin = ((h / 10.0) as usize).min(BINS - 1);
        weight[bin] += w;
        hue_sum[bin] += h * w;
    }

    let total: f32 = weight.iter().sum();
    if total < pixels * 0.03 {
        return Some(Vec::new());
    }

    let mut order: Vec<usize> = (0..BINS).collect();
    order.sort_by(|a, b| weight[*b].total_cmp(&weight[*a]));

    let mut hues: Vec<f32> = Vec::new();
    for bin in order {
        if weight[bin] < total * 0.08 {
            break;
        }
        let hue = hue_sum[bin] / weight[bin];
        if hues.iter().all(|h| hue_distance(*h, hue) >= MIN_SEPARATION) {
            hues.push((hue * 10.0).round() / 10.0);
            if hues.len() == MAX_HUES {
                break;
            }
        }
    }
    Some(hues)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn write_png(name: &str, color: [u8; 3]) -> std::path::PathBuf {
        let path = std::env::temp_dir().join(format!("nexon-palette-{name}.png"));
        let img = image::RgbImage::from_pixel(40, 60, image::Rgb(color));
        img.save(&path).unwrap();
        path
    }

    #[test]
    fn green_image_gives_green_hue() {
        let hues = dominant_hues(&write_png("green", [40, 170, 70])).unwrap();
        assert_eq!(hues.len(), 1);
        assert!((100.0..=150.0).contains(&hues[0]), "got {hues:?}");
    }

    #[test]
    fn gray_image_has_no_hues() {
        assert!(dominant_hues(&write_png("gray", [120, 120, 120])).unwrap().is_empty());
    }

    #[test]
    fn two_color_image_gives_two_hues() {
        let path = std::env::temp_dir().join("nexon-palette-split.png");
        let img = image::RgbImage::from_fn(40, 60, |_, y| {
            if y < 30 { image::Rgb([200, 40, 40]) } else { image::Rgb([40, 80, 200]) }
        });
        img.save(&path).unwrap();
        let hues = dominant_hues(&path).unwrap();
        assert_eq!(hues.len(), 2, "got {hues:?}");
        assert!(hues.iter().any(|h| *h < 20.0 || *h > 340.0)); // red
        assert!(hues.iter().any(|h| (210.0..=240.0).contains(h))); // blue
    }
}
