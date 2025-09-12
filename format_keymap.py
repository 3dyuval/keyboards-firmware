#!/usr/bin/env python3
"""
Custom ZMK keymap formatter that maintains perfect vertical alignment.
Formats keymap bindings to match physical keyboard layout.
"""

import sys
import re
from typing import List, Tuple

def parse_bindings_block(content: str) -> Tuple[str, List[str], str]:
    """Extract the bindings block and return prefix, bindings, suffix"""
    # Find bindings = < ... >;
    pattern = r'(.*?bindings\s*=\s*<)([^>]+)(>;.*)'
    match = re.search(pattern, content, re.DOTALL)
    
    if not match:
        return content, [], ""
    
    prefix = match.group(1)
    bindings_content = match.group(2).strip()
    suffix = match.group(3)
    
    # Split bindings by & symbol, being more careful with whitespace
    tokens = []
    
    # Remove all line breaks and normalize whitespace, but preserve & boundaries
    # Replace newlines and multiple spaces with single spaces
    normalized_content = re.sub(r'\s+', ' ', bindings_content).strip()
    
    # Use regex to find all &... tokens properly
    # This pattern captures & followed by any non-& characters until the next & or end
    pattern = r'&[^&]*?(?=\s*&|$)'
    matches = re.findall(pattern, normalized_content)
    
    for match in matches:
        # Clean up each token - remove extra whitespace but keep the content
        token = re.sub(r'\s+', ' ', match.strip())
        if token:
            tokens.append(token)
    
    return prefix, tokens, suffix

def format_corne_layout(bindings: List[str]) -> str:
    """Format bindings in Corne 3x6+3 layout with perfect alignment"""
    if len(bindings) != 42:  # 3x12 + 6 thumb keys
        # Fallback to simple formatting if not standard Corne layout
        return format_generic_layout(bindings, 6)
    
    # Corne layout: 3 rows of 12 keys + 6 thumb keys
    rows = [
        bindings[0:12],   # Top row
        bindings[12:24],  # Middle row  
        bindings[24:36],  # Bottom row
        bindings[36:42]   # Thumb cluster (split: 3 + 3)
    ]
    
    # Calculate column widths for perfect alignment with extra spacing
    max_widths = []
    for col in range(12):
        max_width = 0
        for row in rows[:3]:  # Only first 3 rows for main keys
            if col < len(row):
                max_width = max(max_width, len(row[col]))
        # Add extra spacing between keys (minimum 2 spaces between each key)
        max_widths.append(max_width + 2)
    
    # Format each row with proper alignment
    formatted_rows = []
    
    # Main 3 rows
    for row in rows[:3]:
        formatted_keys = []
        for i, key in enumerate(row):
            if i < len(max_widths):
                # Use left justify with the calculated width for proper alignment
                formatted_keys.append(key.ljust(max_widths[i]))
            else:
                formatted_keys.append(key)
        # Join without additional spaces since padding is already included
        formatted_rows.append("   " + "".join(formatted_keys))
    
    # Thumb cluster - center-aligned with better spacing
    thumb_left = rows[3][:3]
    thumb_right = rows[3][3:]
    
    # Calculate thumb key widths with extra spacing
    thumb_width = max(max(len(k) for k in thumb_left), max(len(k) for k in thumb_right)) + 2
    thumb_left_formatted = "".join(k.ljust(thumb_width) for k in thumb_left)
    thumb_right_formatted = "".join(k.ljust(thumb_width) for k in thumb_right)
    
    # Add proper spacing to center thumb keys (adjust based on actual content width)
    thumb_spacing = " " * (sum(max_widths[:3]))  # Align with first 3 columns
    formatted_rows.append(f"{thumb_spacing}{thumb_left_formatted.strip()}      {thumb_right_formatted.strip()}")
    
    return "\n".join(formatted_rows)

def format_generic_layout(bindings: List[str], keys_per_row: int) -> str:
    """Generic formatter for non-Corne layouts"""
    rows = []
    for i in range(0, len(bindings), keys_per_row):
        rows.append(bindings[i:i + keys_per_row])
    
    # Calculate column widths with extra spacing
    max_widths = []
    for col in range(keys_per_row):
        max_width = 0
        for row in rows:
            if col < len(row):
                max_width = max(max_width, len(row[col]))
        # Add extra spacing between keys (minimum 2 spaces between each key)
        max_widths.append(max_width + 2)
    
    # Format rows
    formatted_rows = []
    for row in rows:
        formatted_keys = []
        for i, key in enumerate(row):
            if i < len(max_widths):
                formatted_keys.append(key.ljust(max_widths[i]))
            else:
                formatted_keys.append(key)
        # Join without additional spaces since padding is already included
        formatted_rows.append("   " + "".join(formatted_keys))
    
    return "\n".join(formatted_rows)

def format_keymap(content: str) -> str:
    """Format entire keymap file with consistent alignment across all layers"""
    lines = content.split('\n')
    result_lines = []
    
    # First pass: collect all bindings blocks to calculate global max widths
    all_bindings_blocks = []
    all_bindings = []
    
    i = 0
    while i < len(lines):
        line = lines[i]
        
        # Check if this line starts a bindings block
        if 'bindings' in line and '=' in line and '<' in line:
            # Collect the entire bindings block
            block_content = line
            i += 1
            
            # Continue until we find the closing >;
            while i < len(lines) and not ('>; ' in lines[i] or lines[i].strip().endswith('>;')):
                block_content += '\n' + lines[i]
                i += 1
            
            if i < len(lines):
                block_content += '\n' + lines[i]
            
            # Parse this bindings block
            prefix, bindings, suffix = parse_bindings_block(block_content)
            if bindings:
                all_bindings_blocks.append((prefix, bindings, suffix))
                all_bindings.extend(bindings)
        i += 1
    
    # Calculate global column widths across ALL layers
    global_max_widths = calculate_global_widths(all_bindings_blocks)
    
    # Second pass: format with global alignment
    i = 0
    while i < len(lines):
        line = lines[i]
        
        # Check if this line starts a bindings block
        if 'bindings' in line and '=' in line and '<' in line:
            # Collect the entire bindings block
            block_content = line
            i += 1
            
            # Continue until we find the closing >;
            while i < len(lines) and not ('>; ' in lines[i] or lines[i].strip().endswith('>;')):
                block_content += '\n' + lines[i]
                i += 1
            
            if i < len(lines):
                block_content += '\n' + lines[i]
            
            # Format this bindings block with global widths
            prefix, bindings, suffix = parse_bindings_block(block_content)
            if bindings:
                formatted_bindings = format_corne_layout_with_widths(bindings, global_max_widths)
                result_lines.append(f"{prefix.rstrip()}")
                result_lines.append(formatted_bindings)
                result_lines.append(f"         {suffix.strip()}")
            else:
                result_lines.append(block_content)
        else:
            result_lines.append(line)
        
        i += 1
    
    return '\n'.join(result_lines)

def calculate_global_widths(all_bindings_blocks):
    """Calculate maximum column widths across all layers"""
    global_max_widths = []
    
    for col in range(12):  # Corne has 12 columns
        max_width = 0
        for prefix, bindings, suffix in all_bindings_blocks:
            if len(bindings) >= 42:  # Standard Corne layout
                # Check all 3 main rows for this column
                for row in range(3):
                    key_idx = row * 12 + col
                    if key_idx < len(bindings):
                        max_width = max(max_width, len(bindings[key_idx]))
        # Add extra spacing between keys (increased for long function layer bindings)
        global_max_widths.append(max_width + 4)
    
    return global_max_widths

def format_corne_layout_with_widths(bindings: List[str], max_widths: List[int]) -> str:
    """Format bindings in Corne layout using provided column widths"""
    if len(bindings) != 42:  # 3x12 + 6 thumb keys
        # For debugging - print the count
        print(f"Warning: Expected 42 bindings, got {len(bindings)}")
        # Try to handle non-standard layouts gracefully
        if len(bindings) >= 36:  # At least 3 full rows
            # Take first 36 for main keys, rest for thumbs (or pad if needed)
            main_bindings = bindings[:36]
            thumb_bindings = bindings[36:42] if len(bindings) >= 42 else bindings[36:] + ['&trans'] * (42 - len(bindings))
            bindings = main_bindings + thumb_bindings
        else:
            # Fallback to original method for very short lists
            return format_corne_layout(bindings)
    
    # Corne layout: 3 rows of 12 keys + 6 thumb keys
    rows = [
        bindings[0:12],   # Top row
        bindings[12:24],  # Middle row  
        bindings[24:36],  # Bottom row
        bindings[36:42]   # Thumb cluster (split: 3 + 3)
    ]
    
    # Format each row with global alignment
    formatted_rows = []
    
    # Main 3 rows using global widths
    for row in rows[:3]:
        formatted_keys = []
        for i, key in enumerate(row):
            if i < len(max_widths):
                formatted_keys.append(key.ljust(max_widths[i]))
            else:
                formatted_keys.append(key)
        formatted_rows.append("   " + "".join(formatted_keys))
    
    # Thumb cluster - align with columns 4-5-6 and 7-8-9
    thumb_left = rows[3][:3]
    thumb_right = rows[3][3:]
    
    # Format thumb keys using the same column widths as main rows
    # Left thumb: align with columns 4-5-6 (indices 3-4-5)
    # Right thumb: align with columns 7-8-9 (indices 6-7-8)
    thumb_left_formatted = ""
    thumb_right_formatted = ""
    
    # Left thumb cluster - use widths from columns 3,4,5
    for i, key in enumerate(thumb_left):
        col_idx = i + 3  # Align with columns 4,5,6 (0-indexed: 3,4,5)
        if col_idx < len(max_widths):
            thumb_left_formatted += key.ljust(max_widths[col_idx])
        else:
            thumb_left_formatted += key.ljust(max_widths[-1])
    
    # Right thumb cluster - use widths from columns 6,7,8
    for i, key in enumerate(thumb_right):
        col_idx = i + 6  # Align with columns 7,8,9 (0-indexed: 6,7,8)
        if col_idx < len(max_widths):
            thumb_right_formatted += key.ljust(max_widths[col_idx])
        else:
            thumb_right_formatted += key.ljust(max_widths[-1])
    
    # Add spacing to align with the main rows (columns 1-3 spacing)
    thumb_prefix_spacing = sum(max_widths[:3])
    formatted_rows.append(" " * thumb_prefix_spacing + thumb_left_formatted + thumb_right_formatted.rstrip())
    
    return "\n".join(formatted_rows)

def main():
    if len(sys.argv) > 1:
        # Read from file
        with open(sys.argv[1], 'r') as f:
            content = f.read()
    else:
        # Read from stdin
        content = sys.stdin.read()
    
    formatted = format_keymap(content)
    print(formatted, end='')

if __name__ == '__main__':
    main()