from recon_scanner import recon_scanner

print("Testing Recon Scanner Skill...")
results = recon_scanner("google.com", deep_boundary_scan=True)
print(f"Results: {results}")
