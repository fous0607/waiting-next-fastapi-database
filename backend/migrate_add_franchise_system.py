"""
프랜차이즈 시스템 추가 마이그레이션

새로운 테이블:
- franchise: 프랜차이즈
- store: 매장
- users: 사용자 (인증)

기존 테이블 수정:
- store_id 컬럼 추가: store_settings, daily_closing, class_info, members, waiting_list, class_closure, waiting_history
"""

import sqlite3
from pathlib import Path
import shutil
from datetime import datetime
import bcrypt

# 비밀번호 해싱 함수
def hash_password(password: str) -> str:
    """비밀번호를 bcrypt로 해싱"""
    password_bytes = password.encode('utf-8')
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(password_bytes, salt)
    return hashed.decode('utf-8')

def backup_database(db_path):
    """데이터베이스 백업"""
    backup_path = db_path.parent / f"waiting_system_backup_{datetime.now().strftime('%Y%m%d_%H%M%S')}.db"
    shutil.copy2(db_path, backup_path)
    print(f"✓ 데이터베이스 백업 완료: {backup_path}")
    return backup_path

def migrate():
    DB_PATH = 'database/waiting_system.db'
    db_path = Path(__file__).parent / DB_PATH

    if not db_path.exists():
        print("❌ 데이터베이스 파일을 찾을 수 없습니다.")
        return

    # 백업
    backup_path = backup_database(db_path)

    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    try:
        print("\n=== 프랜차이즈 시스템 마이그레이션 시작 ===\n")

        # 1. 새 테이블 생성
        print("1. 새 테이블 생성 중...")

        # Franchise 테이블
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS franchise (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                code TEXT NOT NULL UNIQUE,
                is_active BOOLEAN NOT NULL DEFAULT 1,
                created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
        """)
        print("   ✓ franchise 테이블 생성")

        # Store 테이블
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS store (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                franchise_id INTEGER NOT NULL,
                name TEXT NOT NULL,
                code TEXT NOT NULL UNIQUE,
                is_active BOOLEAN NOT NULL DEFAULT 1,
                created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (franchise_id) REFERENCES franchise (id)
            )
        """)
        print("   ✓ store 테이블 생성")

        # Users 테이블
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT NOT NULL UNIQUE,
                password_hash TEXT NOT NULL,
                role TEXT NOT NULL,
                franchise_id INTEGER,
                store_id INTEGER,
                is_active BOOLEAN NOT NULL DEFAULT 1,
                created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (franchise_id) REFERENCES franchise (id),
                FOREIGN KEY (store_id) REFERENCES store (id)
            )
        """)
        print("   ✓ users 테이블 생성")

        # 2. 기본 데이터 생성
        print("\n2. 기본 데이터 생성 중...")

        # 기본 프랜차이즈 생성
        cursor.execute("""
            INSERT OR IGNORE INTO franchise (id, name, code, is_active)
            VALUES (1, '본사', 'HQ', 1)
        """)
        print("   ✓ 기본 프랜차이즈 생성 (ID: 1, 코드: HQ, 이름: 본사)")

        # 기본 매장 생성
        cursor.execute("""
            INSERT OR IGNORE INTO store (id, franchise_id, name, code, is_active)
            VALUES (1, 1, '1호점', 'S001', 1)
        """)
        print("   ✓ 기본 매장 생성 (ID: 1, 코드: S001, 이름: 1호점)")

        # 기본 관리자 생성
        admin_password_hash = hash_password("admin123")
        cursor.execute("""
            INSERT OR IGNORE INTO users (username, password_hash, role, franchise_id, is_active)
            VALUES ('admin', ?, 'franchise_admin', 1, 1)
        """, (admin_password_hash,))
        print("   ✓ 기본 관리자 생성 (username: admin, password: admin123, role: franchise_admin)")

        # 3. 기존 테이블에 store_id 컬럼 추가
        print("\n3. 기존 테이블에 store_id 컬럼 추가 중...")

        tables_to_migrate = [
            "store_settings",
            "daily_closing",
            "class_info",
            "members",
            "waiting_list",
            "class_closure",
            "waiting_history"
        ]

        for table_name in tables_to_migrate:
            # 컬럼 존재 여부 확인
            cursor.execute(f"PRAGMA table_info({table_name})")
            columns = [col[1] for col in cursor.fetchall()]

            if 'store_id' not in columns:
                # store_id 컬럼 추가 (nullable로 먼저 추가)
                cursor.execute(f"""
                    ALTER TABLE {table_name}
                    ADD COLUMN store_id INTEGER
                """)
                print(f"   ✓ {table_name} 테이블에 store_id 컬럼 추가")
            else:
                print(f"   - {table_name} 테이블은 이미 store_id 컬럼이 있음")

        # 4. 기존 데이터를 1호점에 연결
        print("\n4. 기존 데이터를 1호점(ID: 1)에 연결 중...")

        for table_name in tables_to_migrate:
            cursor.execute(f"""
                UPDATE {table_name}
                SET store_id = 1
                WHERE store_id IS NULL
            """)
            updated_count = cursor.rowcount
            print(f"   ✓ {table_name}: {updated_count}개 레코드 업데이트")

        # 5. SQLite는 ALTER TABLE로 NOT NULL 제약 조건을 추가할 수 없으므로
        #    새 테이블을 만들고 데이터를 복사하는 방식으로 처리해야 하지만,
        #    단순화를 위해 현재 단계에서는 생략 (애플리케이션 레벨에서 검증)
        print("\n5. 제약 조건 처리...")
        print("   ⚠ SQLite 제한으로 NOT NULL 제약 조건은 애플리케이션 레벨에서 적용됨")

        # daily_closing의 unique 제약 조건 수정
        # business_date만 unique였던 것을 (store_id, business_date) 조합으로 변경
        print("\n6. daily_closing 테이블 unique 제약 조건 수정 중...")
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS daily_closing_new (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                store_id INTEGER NOT NULL,
                business_date DATE NOT NULL,
                opening_time TIMESTAMP,
                closing_time TIMESTAMP,
                is_closed BOOLEAN NOT NULL DEFAULT 0,
                total_waiting INTEGER NOT NULL DEFAULT 0,
                total_attended INTEGER NOT NULL DEFAULT 0,
                total_cancelled INTEGER NOT NULL DEFAULT 0,
                created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (store_id) REFERENCES store (id),
                UNIQUE (store_id, business_date)
            )
        """)

        cursor.execute("""
            INSERT INTO daily_closing_new
            SELECT * FROM daily_closing
        """)

        cursor.execute("DROP TABLE daily_closing")
        cursor.execute("ALTER TABLE daily_closing_new RENAME TO daily_closing")
        print("   ✓ daily_closing 테이블 재생성 완료")

        conn.commit()
        print("\n✅ 마이그레이션 완료!")
        print(f"\n기본 로그인 정보:")
        print(f"   Username: admin")
        print(f"   Password: admin123")
        print(f"\n⚠ 보안을 위해 첫 로그인 후 비밀번호를 변경하세요!")

    except Exception as e:
        conn.rollback()
        print(f"\n❌ 마이그레이션 실패: {e}")
        print(f"\n백업 파일로 복원하려면 다음 명령을 실행하세요:")
        print(f"   cp {backup_path} {db_path}")
        raise
    finally:
        conn.close()

if __name__ == "__main__":
    migrate()
