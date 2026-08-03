import sys
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8")

import uvicorn
from mariano.web.app import app

# Explicitly import all core skills so PyInstaller can trace and package them
import mariano.skills.core_skills.deep_research.skill
import mariano.skills.core_skills.file_manager.skill
import mariano.skills.core_skills.run_command.skill
import mariano.skills.core_skills.generate_image.skill
import mariano.skills.core_skills.image_analysis.skill
import mariano.skills.core_skills.memory_ops.skill
import mariano.skills.core_skills.morning_briefing.skill
import mariano.skills.core_skills.news_fetch.skill
import mariano.skills.core_skills.reminder.skill
import mariano.skills.core_skills.stock_data.skill
import mariano.skills.core_skills.translator.skill
import mariano.skills.core_skills.weather.skill
import mariano.skills.core_skills.web_scraper.skill
import mariano.skills.core_skills.web_search.skill
import mariano.skills.core_skills.wikipedia_search.skill
import mariano.skills.core_skills.physics_solver.skill
import mariano.skills.core_skills.data_analyzer.skill

import multiprocessing

if __name__ == "__main__":
    # Essential for PyInstaller on Windows when using multiprocessing or async servers
    multiprocessing.freeze_support()
    print("====================================================")
    print("MARIANO HUD WEB SERVER INITIATED")
    print("Local Access:   http://localhost:8000")
    print("Network Access (Phone): http://[YOUR-PC-IP]:8000")
    print("WebSocket Pipe: ws://localhost:8000/ws")
    print("====================================================")
    uvicorn.run(app, host="0.0.0.0", port=8000, log_level="info")
