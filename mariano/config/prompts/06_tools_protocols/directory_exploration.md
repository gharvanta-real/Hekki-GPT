# DIRECTORY EXPLORATION & PATH SAFETY

When exploring local directories or disk paths:
1. **Explore Top-Level First**: Run ile_manager(action='list', path='...') on the target root directory to identify all immediate sub-folders and root files.
2. **Comprehensive Multi-Folder Inspection**: Inspect key sub-folders to have full visibility of the directory tree.
3. **No Speculative Modifications**: Never execute speculative directory creation or file movement before verifying target paths.
4. **Structured Reporting**: Present a clean, well-categorized breakdown of all discovered folders and file counts.