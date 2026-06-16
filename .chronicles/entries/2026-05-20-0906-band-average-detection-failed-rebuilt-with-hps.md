# 2026-05-20 — Band-average detection failed; rebuilt with HPS

**Question:** The band-average approach was tested on iPhone and was unacceptable — couldn't find a threshold that worked across all registers. Is there a fundamentally better detection signal?

**Failure mode of band-average:** High cello notes produce lower absolute energy in the band than low notes. Any threshold high enough to reject voice also missed soft high-register playing. Threshold low enough to catch high notes triggered on talking. No usable operating point existed.

**Root cause:** Band average measures *how much energy* is in the cello range, not *what kind* of energy. Voice and cello overlap heavily in frequency. The algorithm had no way to distinguish them.

**Switched to HPS (Harmonic Product Spectrum).** Cello produces a clean harmonic series (f, 2f, 3f, 4f...). HPS multiplies the spectrum against downsampled copies of itself — energy survives only where all harmonics are simultaneously present. Voice formants create gaps at some harmonics, collapsing the product. Result: a sharp spike at the fundamental for pitched instruments, low flat noise for voice and ambience.

**Implementation:** Geometric mean of 4 harmonics (normalized to 0–255 scale). FFT size increased to 4096 for better low-frequency resolution (~10.8 Hz/bin). Detection: peak HPS value in 65–1200 Hz range vs. threshold, same 300ms attack / 1500ms release debounce.

**UI change:** Spectrum analyzer bars now show HPS values instead of raw FFT. The display shows a single spike at the detected fundamental rather than a forest of harmonic bars — much cleaner signal for threshold tuning. Peak bar highlighted white; note name + frequency shown in canvas corner when a peak is visible. Threshold slider range extended to 200 after first on-device test revealed values run higher than predicted.

**Next resolved to:** tune threshold during real practice; assess whether HPS cleanly separates cello from ambient noise at a consistent operating point.
