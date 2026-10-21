import os
import re

def check_use_effects():
    for root, dirs, files in os.walk("src"):
        for f in files:
            if f.endswith(".tsx") or f.endswith(".ts"):
                path = os.path.join(root, f)
                with open(path, "r", encoding="utf-8", errors="ignore") as file:
                    content = file.read()
                
                pos = 0
                while True:
                    found = content.find("useEffect(", pos)
                    if found == -1:
                        break
                    pos = found + 10
                    line_no = content[:found].count("\n") + 1
                    
                    p_count = 1
                    i = found + 10
                    in_str = None
                    in_comment = False
                    while i < len(content) and p_count > 0:
                        ch = content[i]
                        if in_comment:
                            if ch == "\n":
                                in_comment = False
                        elif in_str:
                            if ch == "\\" and i + 1 < len(content):
                                i += 1
                            elif ch == in_str:
                                in_str = None
                        else:
                            if ch in ('"', "'", '`'):
                                in_str = ch
                            elif ch == "/" and i + 1 < len(content) and content[i+1] == "/":
                                in_comment = True
                                i += 1
                            elif ch == "(":
                                p_count += 1
                            elif ch == ")":
                                p_count -= 1
                        i += 1
                    
                    inner = content[found+10 : i-1].strip()
                    trailing = re.sub(r"/\*.*?\*/", "", inner, flags=re.DOTALL).strip()
                    trailing = re.sub(r"//[^\n]*", "", trailing).strip()
                    if not trailing.endswith("]"):
                        print(f"POSSIBLE NO DEPS: {path}:{line_no} -> ends with: {trailing[-40:] if len(trailing)>40 else trailing}")

check_use_effects()
