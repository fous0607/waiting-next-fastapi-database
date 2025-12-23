from auth import verify_password
import os

# Password hash for cellstar01 from DB
hash_val = "$2b$12$eoOP2n0BmYeTGlys3BXiVeQVAXMkYVd0h/FDynavw3Urm5Ukk3b/a"
password_to_test = "1212"

is_correct = verify_password(password_to_test, hash_val)

if is_correct:
    print(f"Password '{password_to_test}' is CORRECT for the hash.")
else:
    print(f"Password '{password_to_test}' is INCORRECT for the hash.")
