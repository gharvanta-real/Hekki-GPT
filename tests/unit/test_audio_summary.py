"""Tests for MARIANO Audio Summary & Lossless PDF Chapter Engine."""
import pytest
import fitz
from pathlib import Path

from mariano.core.audio_summary_engine import AudioSummaryEngine, AUDIO_CACHE_DIR


def create_sample_multi_chapter_pdf(filepath: str):
    """Creates a sample multi-page PDF with chapters for testing."""
    doc = fitz.open()
    
    # Chapter 1: Introduction
    p1 = doc.new_page()
    p1.insert_text((50, 50), "Chapter 1: Foundations of Quantum Physics", fontsize=18)
    p1.insert_text((50, 100), "Quantum mechanics is a fundamental theory in physics that provides a description of the physical properties of nature at the scale of atoms and subatomic particles.", fontsize=11)
    
    p2 = doc.new_page()
    p2.insert_text((50, 50), "Key Equations in Quantum Mechanics: E = h * f", fontsize=12)

    # Chapter 2: Wave Particle Duality
    p3 = doc.new_page()
    p3.insert_text((50, 50), "Chapter 2: Wave Particle Duality", fontsize=18)
    p3.insert_text((50, 100), "Wave–particle duality is the concept in quantum mechanics that every particle or quantum entity may be described as either a particle or a wave.", fontsize=11)

    # Save
    doc.save(filepath)
    doc.close()


def test_pdf_chapter_scan_and_extraction(tmp_path):
    test_pdf = str(tmp_path / "quantum_test.pdf")
    create_sample_multi_chapter_pdf(test_pdf)

    engine = AudioSummaryEngine.get_instance()
    scan_result = engine.scan_pdf(test_pdf, original_filename="quantum_test.pdf")

    assert scan_result["total_pages"] == 3
    assert scan_result["total_chapters"] >= 2
    assert "ch_1" in [c["chapter_id"] for c in scan_result["chapters"]]

    # Verify lossless text extraction
    extracted = engine.extract_chapter_text(scan_result["pdf_id"], 1, 2)
    assert "Foundations of Quantum Physics" in extracted
    assert "E = h * f" in extracted


@pytest.mark.asyncio
async def test_edge_tts_hindi_synthesis(tmp_path):
    import edge_tts
    out_mp3 = tmp_path / "test_hindi.mp3"
    hindi_text = "नमस्ते, यह क्वांटम फिजिक्स का एक संपूर्ण और स्पष्ट हिंदी सारांश है।"
    
    communicate = edge_tts.Communicate(hindi_text, voice="hi-IN-SwaraNeural")
    await communicate.save(str(out_mp3))

    assert out_mp3.exists()
    assert out_mp3.stat().st_size > 1000  # Valid MP3 data written
