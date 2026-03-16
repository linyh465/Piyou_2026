"""
校網登入測試腳本 / School Portal Login Test Script

用法 / Usage:
    python test_school_login.py

⚠️ 此腳本會提示你輸入學號和密碼，帳密不會被記錄。
   This script prompts for credentials; they are NOT logged.
"""
import getpass
import sys
import os

# 確保可以 import app 模組 / Ensure app module is importable
sys.path.insert(0, os.path.dirname(__file__))

from app.services.scraper import SchoolScraper


def main():
    print("=" * 50)
    print("  校網登入測試 / School Portal Login Test")
    print(f"  目標 / Target: {os.getenv('SCHOOL_PORTAL_URL', 'https://alcat.pu.edu.tw')}")
    print("=" * 50)
    print()

    student_id = input("學號 / Student ID: ").strip()
    if not student_id:
        print("❌ 學號不可為空 / Student ID cannot be empty")
        return

    # 改用 input 以避免某些終端機無法輸入的問題
    # Switched to input() to avoid issues in some terminals
    print("⚠️ 注意：密碼將會顯示在螢幕上 / Note: Password will be visible")
    password = input("密碼 / Password: ").strip()
    if not password:
        print("❌ 密碼不可為空 / Password cannot be empty")
        return

    print()
    print("⏳ 正在嘗試登入... / Attempting login...")

    scraper = SchoolScraper()

    try:
        result = scraper.login(student_id, password)
        print()
        print("✅ 登入成功！/ Login Successful!")
        print(f"   學號 / Student ID: {result.get('student_id', 'N/A')}")
        print(f"   姓名 / Name:       {result.get('name', 'N/A')}")
        print(f"   學校 / School:      {result.get('department', 'N/A')}")
        print()

        # 嘗試取得課表 / Try to fetch timetable
        print("📚 正在爬取課表資料...")
        timetable = scraper.fetch_timetable()
        if timetable:
            print(f"   ✅ 課表取得成功！/ Timetable fetched successfully!")
            print(f"   📅 學期 / Semester: {timetable.get('semester', 'N/A')}")
            info = timetable.get('student_info', {})
            print(f"   👤 姓名 / Name: {info.get('name', 'N/A')}")
            print(f"   🏫 班級 / Class: {info.get('class_name', 'N/A')}")
            print(f"   📊 總學分 / Total Credits: {timetable.get('total_credits', 0)}")
            print(f"   📝 課程數 / Courses: {len(timetable.get('courses', []))}")
            print()
            for i, c in enumerate(timetable.get('courses', []), 1):
                print(f"   {i}. [{c['code']}] {c['name_zh']} ({c['name_en']})")
                print(f"      {c['type']} | {c['credits']}學分 | {c['schedule_raw']} | {c['teacher_email']}")
        else:
            print("   ❌ 課表取得失敗 / Failed to fetch timetable")

        print()

        # 嘗試取得成績 / Try to fetch grades
        print("📊 正在爬取成績資料...")
        grades = scraper.fetch_grades()
        if grades:
            print(f"   ✅ 成績取得成功！/ Grades fetched!")
            rows = grades.get('rows', [])
            print(f"   📝 成績列數 / Grade rows: {len(rows)}")
            for i, row in enumerate(rows[:10], 1):  # Show first 10 rows
                print(f"   {i}. {' | '.join(row)}")
            if len(rows) > 10:
                print(f"   ... and {len(rows) - 10} more rows")
        else:
            print("   ❌ 成績取得失敗 / Failed to fetch grades")

    except Exception as e:
        print()
        print(f"❌ 登入失敗 / Login Failed: {e}")
        print()
        print("可能原因 / Possible reasons:")
        print("  1. 帳號或密碼錯誤 / Wrong credentials")
        print("  2. 校網暫時無法連線 / Portal temporarily unavailable")
        print("  3. 登入機制已更新 / Login mechanism changed")


if __name__ == "__main__":
    main()
