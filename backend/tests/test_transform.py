"""
資料轉換函數單元測試 / Unit tests for data transformer functions
測試 transform_timetable 與 transform_grades 的各種情境
Tests various scenarios for transform_timetable and transform_grades.
"""
import pytest
from app.routers.data import transform_timetable, transform_grades


# ══════════════════════════════════════════
#  transform_timetable 測試
# ══════════════════════════════════════════

class TestTransformTimetable:
    """課表轉換測試 / Timetable transformer tests"""

    def test_single_course_single_period(self):
        """單門課程、單一節次"""
        raw = {
            "semester": "113-2",
            "student_info": {"name": "王小明", "class_name": "資工二A"},
            "total_credits": 3,
            "courses": [
                {
                    "name_zh": "程式設計",
                    "name_en": "Programming",
                    "day": "Mon",
                    "periods": "1",
                    "room": "理101",
                    "teacher_name": "林教授",
                    "teacher_email": "lin@pu.edu.tw",
                    "type": "必修",
                    "credits": 3,
                }
            ],
        }
        result = transform_timetable(raw)

        assert len(result.courses) == 1
        c = result.courses[0]
        assert c.name == "程式設計"
        assert c.name_en == "Programming"
        assert c.day == 1  # Mon → 1
        assert c.period == 1
        assert c.startMinute == 490  # period 1 → 490
        assert c.location == "理101"
        assert c.teacher == "林教授"
        assert c.teacher_email == "lin@pu.edu.tw"
        assert c.time == "08:10-09:00"
        assert c.course_type == "必修"
        assert c.credits == 3
        assert result.total_credits == 3
        assert result.semester == "113-2"
        assert result.student_name == "王小明"
        assert result.class_name == "資工二A"

    def test_multiple_periods_expand(self):
        """多節次應展開成多個 Course 物件"""
        raw = {
            "courses": [
                {
                    "name_zh": "微積分",
                    "day": "Tue",
                    "periods": "3, 4",
                    "room": "理201",
                    "type": "必修",
                    "credits": 4,
                }
            ],
        }
        result = transform_timetable(raw)

        assert len(result.courses) == 2
        assert result.courses[0].period == 3
        assert result.courses[0].startMinute == 610
        assert result.courses[0].time == "10:10-11:00"
        assert result.courses[1].period == 4
        assert result.courses[1].startMinute == 670
        assert result.courses[1].time == "11:10-12:00"

    def test_day_mapping(self):
        """所有星期對照 / All day mappings"""
        days_expected = {
            "Mon": 1, "Tue": 2, "Wed": 3,
            "Thu": 4, "Fri": 5, "Sat": 6, "Sun": 0,
        }
        for day_str, expected_int in days_expected.items():
            raw = {"courses": [{"name_zh": "X", "day": day_str, "periods": "1"}]}
            result = transform_timetable(raw)
            assert result.courses[0].day == expected_int, f"{day_str} should map to {expected_int}"

    def test_unknown_day_defaults_to_zero(self):
        """未知星期字串 → 0"""
        raw = {"courses": [{"name_zh": "X", "day": "???", "periods": "1"}]}
        result = transform_timetable(raw)
        assert result.courses[0].day == 0

    def test_empty_courses(self):
        """空課表"""
        raw = {"courses": [], "semester": "113-2", "total_credits": 0}
        result = transform_timetable(raw)
        assert result.courses == []
        assert result.total_credits == 0

    def test_no_teacher_email(self):
        """無教師 email → teacher 為 None"""
        raw = {"courses": [{"name_zh": "X", "day": "Mon", "periods": "1", "teacher_email": ""}]}
        result = transform_timetable(raw)
        assert result.courses[0].teacher is None

    def test_missing_fields_graceful(self):
        """欄位缺失時不崩潰"""
        raw = {"courses": [{}]}
        result = transform_timetable(raw)
        assert len(result.courses) == 0  # no periods → no expansion

    def test_period_start_all_values(self):
        """所有 13 個節次的起始分鐘值"""
        expected = {
            1: 490, 2: 550, 3: 610, 4: 670,
            5: 790, 6: 850, 7: 910, 8: 970,
            9: 1030, 10: 1085, 11: 1140, 12: 1195, 13: 1250,
        }
        for period, start_min in expected.items():
            raw = {"courses": [{"name_zh": "X", "day": "Mon", "periods": str(period)}]}
            result = transform_timetable(raw)
            assert result.courses[0].startMinute == start_min, f"Period {period}"

    def test_student_info_defaults(self):
        """student_info 缺失時回傳空字串"""
        raw = {"courses": []}
        result = transform_timetable(raw)
        assert result.student_name == ""
        assert result.class_name == ""

    def test_multiple_courses(self):
        """多門課程"""
        raw = {
            "courses": [
                {"name_zh": "A", "day": "Mon", "periods": "1", "credits": 2},
                {"name_zh": "B", "day": "Wed", "periods": "5, 6", "credits": 3},
            ],
            "total_credits": 5,
        }
        result = transform_timetable(raw)
        assert len(result.courses) == 3  # 1 + 2
        names = [c.name for c in result.courses]
        assert names.count("A") == 1
        assert names.count("B") == 2


# ══════════════════════════════════════════
#  transform_grades 測試
# ══════════════════════════════════════════

class TestTransformGrades:
    """成績轉換測試 / Grades transformer tests"""

    def test_basic_numeric_grades(self):
        """基本數字成績轉換"""
        raw = {
            "rows": [
                ["程式設計", "CS101", "必修", "3", "92"],
                ["微積分", "MA101", "必修", "4", "85"],
            ]
        }
        result = transform_grades(raw)

        assert len(result.semesters) == 1
        sem = result.semesters[0]
        assert sem.name == "學期成績"
        assert len(sem.courses) == 2

        c0 = sem.courses[0]
        assert c0.name == "程式設計"
        assert c0.score == 92.0
        assert c0.credits == 3
        assert c0.grade == "A+"  # 92 → GPA 4.3 → A+
        assert c0.course_type == "必修"

        c1 = sem.courses[1]
        assert c1.score == 85.0
        assert c1.grade == "A"  # 85 → GPA 4.0 → A
        assert c1.credits == 4

    def test_gpa_scale_boundaries(self):
        """GPA 4.3 制邊界值測試"""
        # (score, expected_grade, expected_gpa_range)
        boundary_cases = [
            (100, "A+"),
            (90, "A+"),
            (89, "A"),
            (85, "A"),
            (84, "A-"),
            (80, "A-"),
            (79, "B+"),
            (77, "B+"),
            (76, "B"),
            (73, "B"),
            (72, "B-"),
            (70, "B-"),
            (69, "C+"),
            (67, "C+"),
            (66, "C"),
            (63, "C"),
            (62, "C-"),
            (60, "C-"),
            (59, "D"),
            (50, "D"),
            (49, "F"),
            (0, "F"),
        ]
        for score, expected_grade in boundary_cases:
            raw = {"rows": [["X", "C1", "必修", "3", str(score)]]}
            result = transform_grades(raw)
            actual = result.semesters[0].courses[0].grade
            assert actual == expected_grade, f"Score {score}: expected {expected_grade}, got {actual}"

    def test_weighted_average_calculation(self):
        """加權平均計算"""
        raw = {
            "rows": [
                ["A", "C1", "必修", "3", "90"],  # 270
                ["B", "C2", "必修", "2", "80"],  # 160
            ]
        }
        result = transform_grades(raw)
        sem = result.semesters[0]
        # (270 + 160) / 5 = 86.0
        assert sem.weighted_average == 86.0

    def test_gpa_calculation(self):
        """GPA 計算"""
        raw = {
            "rows": [
                ["A", "C1", "", "3", "92"],  # GPA 4.3 × 3 = 12.9
                ["B", "C2", "", "2", "85"],  # GPA 4.0 × 2 = 8.0
            ]
        }
        result = transform_grades(raw)
        sem = result.semesters[0]
        # (12.9 + 8.0) / 5 = 4.18
        assert sem.gpa == 4.18

    def test_gpa_max_capped_at_4_3(self):
        """GPA 上限為 4.3"""
        raw = {"rows": [["A", "C1", "", "3", "100"]]}
        result = transform_grades(raw)
        assert result.semesters[0].gpa <= 4.3

    def test_pass_fail_grades(self):
        """通過/不通過 成績（非數字）"""
        raw = {
            "rows": [
                ["體育", "PE1", "必修", "0", "通過"],
            ]
        }
        result = transform_grades(raw)
        c = result.semesters[0].courses[0]
        assert c.score is None
        assert c.score_text == "通過"
        assert c.grade == "Pass"

    def test_withdrawal_grade(self):
        """缺課 / 退選成績"""
        raw = {"rows": [["X", "C1", "", "3", "缺"]]}
        result = transform_grades(raw)
        c = result.semesters[0].courses[0]
        assert c.score is None
        assert c.score_text == "缺"
        assert c.grade == "W"

    def test_non_numeric_excluded_from_gpa(self):
        """非數字成績不納入加權平均與 GPA"""
        raw = {
            "rows": [
                ["A", "C1", "", "3", "90"],
                ["B", "C2", "", "0", "通過"],
            ]
        }
        result = transform_grades(raw)
        sem = result.semesters[0]
        assert sem.weighted_average == 90.0
        assert sem.gpa == 4.3

    def test_empty_rows(self):
        """空成績列表"""
        raw = {"rows": []}
        result = transform_grades(raw)
        assert result.semesters == []

    def test_short_row_skipped(self):
        """len(row) < 5 的列應跳過"""
        raw = {"rows": [["X", "Y"]]}
        result = transform_grades(raw)
        assert result.semesters == []

    def test_invalid_credits_defaults_to_zero(self):
        """無法解析學分數時 defaults to 0"""
        raw = {"rows": [["X", "C1", "", "abc", "90"]]}
        result = transform_grades(raw)
        c = result.semesters[0].courses[0]
        assert c.credits == 0

    def test_total_credits_sum(self):
        """total_credits 為所有科目學分總和（含非數字成績）"""
        raw = {
            "rows": [
                ["A", "C1", "", "3", "90"],
                ["B", "C2", "", "2", "通過"],
            ]
        }
        result = transform_grades(raw)
        assert result.semesters[0].total_credits == 5

    def test_rank_info(self):
        """排名資訊"""
        raw = {"rows": [["A", "C1", "", "3", "90"]], "rank": "5/60"}
        result = transform_grades(raw)
        assert result.semesters[0].rank == "5/60"
        assert result.semesters[0].class_rank is None
        assert result.semesters[0].dept_rank is None

    def test_rank_defaults_to_none(self):
        """無排名資訊"""
        raw = {"rows": [["A", "C1", "", "3", "90"]]}
        result = transform_grades(raw)
        assert result.semesters[0].rank is None
        assert result.semesters[0].class_rank is None
        assert result.semesters[0].dept_rank is None

    def test_class_and_dept_rank(self):
        """班排名與系排名 / Class rank and dept rank"""
        raw = {
            "rows": [["A", "C1", "", "3", "90"]],
            "class_rank": "3/50",
            "dept_rank": "10/120",
        }
        result = transform_grades(raw)
        sem = result.semesters[0]
        assert sem.class_rank == "3/50"
        assert sem.dept_rank == "10/120"

    def test_multi_semester_parsing(self):
        """多學期動態解析 / Multi-semester dynamic parsing"""
        raw = {
            "semesters": [
                {
                    "name": "113-1 上學期",
                    "rows": [
                        ["程式設計", "CS101", "必修", "3", "92"],
                        ["微積分", "MA101", "必修", "4", "85"],
                    ],
                    "rank": "3/60",
                    "class_rank": "3/60",
                    "dept_rank": "8/120",
                },
                {
                    "name": "112-2 下學期",
                    "rows": [
                        ["資料結構", "CS201", "必修", "3", "88"],
                    ],
                    "rank": None,
                },
            ]
        }
        result = transform_grades(raw)
        assert len(result.semesters) == 2
        assert result.semesters[0].name == "113-1 上學期"
        assert len(result.semesters[0].courses) == 2
        assert result.semesters[0].rank == "3/60"
        assert result.semesters[0].class_rank == "3/60"
        assert result.semesters[0].dept_rank == "8/120"
        assert result.semesters[0].gpa is not None
        assert result.semesters[0].weighted_average is not None

        assert result.semesters[1].name == "112-2 下學期"
        assert len(result.semesters[1].courses) == 1
        assert result.semesters[1].courses[0].name == "資料結構"
        assert result.semesters[1].courses[0].score == 88.0

    def test_multi_semester_empty_rows_skipped(self):
        """空學期被跳過 / Empty semesters are skipped"""
        raw = {
            "semesters": [
                {"name": "113-1", "rows": [], "rank": None},
                {"name": "112-2", "rows": [["A", "C1", "", "3", "90"]], "rank": None},
            ]
        }
        result = transform_grades(raw)
        assert len(result.semesters) == 1
        assert result.semesters[0].name == "112-2"
