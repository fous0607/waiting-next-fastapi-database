from datetime import datetime, date, timedelta
today = date.today()
period = 'daily'
if period == 'daily':
    start_date = today - timedelta(days=today.weekday())
else:
    start_date = today
print(f"start_date: {start_date}")

class W:
    def __init__(self, r):
        self.registered_at = r
w = W(datetime.now())
h = (w.registered_at + timedelta(hours=9)).hour
print(f"h: {h}")

dt = datetime.combine(start_date, datetime.min.time())
print(f"dt: {dt}")
