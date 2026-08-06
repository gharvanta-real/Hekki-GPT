"""Test script for Red Team skills — load chain + live execution."""
import asyncio
import sys

async def test_imports():
    print("=" * 60)
    print("TEST 1: Import Chain")
    print("=" * 60)
    try:
        from mariano.skills._base import BaseSkill, SkillResult
        print("[PASS] BaseSkill, SkillResult import OK")
    except Exception as e:
        print(f"[FAIL] BaseSkill import: {e}")
        return False

    try:
        from mariano.skills._registry.registry import SkillRegistry
        print("[PASS] SkillRegistry import OK")
    except Exception as e:
        print(f"[FAIL] SkillRegistry import: {e}")
        return False

    try:
        from mariano.skills._registry.loader import SkillLoader
        print("[PASS] SkillLoader import OK")
    except Exception as e:
        print(f"[FAIL] SkillLoader import: {e}")
        return False

    return True


async def test_skill_loading():
    print()
    print("=" * 60)
    print("TEST 2: Skill Loading into Registry")
    print("=" * 60)
    from mariano.skills._registry.registry import SkillRegistry
    from mariano.skills._registry.loader import SkillLoader

    r = SkillRegistry.get_instance()
    loader = SkillLoader(r)

    skills = [
        ("recon_scanner", "mariano.skills.core_skills.recon_scanner.skill"),
        ("security_header_analyzer", "mariano.skills.core_skills.security_header_analyzer.skill"),
        ("red_team_ops", "mariano.skills.core_skills.red_team_ops.skill"),
    ]

    all_ok = True
    for name, module_path in skills:
        try:
            ok = await loader.load_from_module(module_path)
            status = "[PASS]" if ok else "[FAIL]"
            print(f"{status} Load '{name}': {ok}")
            if not ok:
                all_ok = False
        except Exception as e:
            print(f"[FAIL] Load '{name}' exception: {e}")
            all_ok = False

    print(f"\nRegistered skills: {r.skill_names}")
    return all_ok


async def test_red_team_no_target():
    print()
    print("=" * 60)
    print("TEST 3: red_team_ops — no target (persona only mode)")
    print("=" * 60)
    from mariano.skills._registry.registry import SkillRegistry

    r = SkillRegistry.get_instance()
    result = await r.execute(
        "red_team_ops",
        mode="dual",
        task_brief="Competition test — validate skill loads and outputs correct structure.",
        run_live_scan=False,
    )
    print(f"Success: {result.success}")
    if result.success:
        print(f"[PASS] Data length: {len(str(result.data))} chars")
        print(f"Metadata: {result.metadata}")
        print("\n--- Output Preview (first 600 chars) ---")
        print(str(result.data)[:600])
    else:
        print(f"[FAIL] Error: {result.error}")
    return result.success


async def test_header_analyzer_live():
    print()
    print("=" * 60)
    print("TEST 4: security_header_analyzer — live scan on example.com")
    print("=" * 60)
    from mariano.skills._registry.registry import SkillRegistry

    r = SkillRegistry.get_instance()
    result = await r.execute(
        "security_header_analyzer",
        target_url="https://example.com",
    )
    print(f"Success: {result.success}")
    if result.success:
        meta = result.metadata or {}
        print(f"[PASS] Grade: {meta.get('security_grade')} | CVSS: {meta.get('cvss_risk_score')} | Status: {meta.get('status_code')}")
        print(f"CORS: {meta.get('cors_origin')} | Server: {meta.get('server_disclosure')}")
        findings = meta.get('findings', [])
        passes = sum(1 for f in findings if f.get('status') == 'PASS')
        fails = sum(1 for f in findings if f.get('status') == 'FAIL')
        print(f"Headers: {passes} PASS / {fails} FAIL")
    else:
        print(f"[FAIL] Error: {result.error}")
    return result.success


async def test_recon_scanner_live():
    print()
    print("=" * 60)
    print("TEST 5: recon_scanner — live scan on example.com")
    print("=" * 60)
    from mariano.skills._registry.registry import SkillRegistry

    r = SkillRegistry.get_instance()
    result = await r.execute(
        "recon_scanner",
        target_domain="example.com",
        deep_boundary_scan=True,
    )
    print(f"Success: {result.success}")
    if result.success:
        meta = result.metadata or {}
        print(f"[PASS] Active endpoints: {meta.get('active_endpoints')}")
        print(f"Boundary exposures: {meta.get('boundary_exposures_found')}")
        print(f"Risk score: {meta.get('risk_score')}/100 — {meta.get('risk_level')}")
    else:
        print(f"[FAIL] Error: {result.error}")
    return result.success


async def test_full_red_team_ops():
    print()
    print("=" * 60)
    print("TEST 6: red_team_ops DUAL — full live run on example.com")
    print("=" * 60)
    from mariano.skills._registry.registry import SkillRegistry

    r = SkillRegistry.get_instance()
    result = await r.execute(
        "red_team_ops",
        mode="dual",
        target_domain="example.com",
        task_brief="Full dual scan — validate attack path scoreboard + defense queue",
        run_live_scan=True,
        deep_boundary_scan=True,
    )
    print(f"Success: {result.success}")
    if result.success:
        meta = result.metadata or {}
        print(f"[PASS] Attack paths: {meta.get('attack_path_count')} | Defense items: {meta.get('defense_item_count')}")
        print(f"Recon risk: {meta.get('recon_risk_score')} | Header grade: {meta.get('header_grade')} | CVSS: {meta.get('cvss_risk_score')}")
        errors = meta.get('scan_errors', [])
        if errors:
            print(f"Scan errors: {errors}")
        print("\n--- Report Preview (first 800 chars) ---")
        print(str(result.data)[:800])
    else:
        print(f"[FAIL] Error: {result.error}")
    return result.success


async def main():
    results = {}

    results["imports"] = await test_imports()
    if not results["imports"]:
        print("\n[FATAL] Import chain broken — cannot proceed")
        return

    results["loading"] = await test_skill_loading()
    if not results["loading"]:
        print("\n[FATAL] Skill loading failed — cannot proceed")
        return

    results["no_target"] = await test_red_team_no_target()
    results["header_live"] = await test_header_analyzer_live()
    results["recon_live"] = await test_recon_scanner_live()
    results["full_dual"] = await test_full_red_team_ops()

    print()
    print("=" * 60)
    print("FINAL RESULTS SUMMARY")
    print("=" * 60)
    for test, passed in results.items():
        status = "[PASS]" if passed else "[FAIL]"
        print(f"  {status} {test}")

    total = len(results)
    passed = sum(1 for v in results.values() if v)
    pct = int(passed / total * 100)
    print(f"\nScore: {passed}/{total} tests passed ({pct}%)")


if __name__ == "__main__":
    asyncio.run(main())
