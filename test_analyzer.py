import sys
sys.stdout.reconfigure(encoding='utf-8', errors='replace')
from analyzer import analyze_message, analyze_url

tests = [
    ('SCAM-vakansiya', 'Ischem lyudej dlya prostoj udalyonnoj raboty. Dohod 200000 tenge v nedelyu. Nuzhno zaregistrirovatsya i vnesti depozit 50000000000 tenge.'),
    ('Scam-vakansiya RU', 'Ищем людей для простой удалённой работы. Доход 200 000 тенге в неделю. Нужно зарегистрироваться и внести депозит 50000000000 тенге.'),
    ('Bank-fishing', 'Ваш счет заблокирован! Служба безопасности банка. Срочно сообщите CVV и код из SMS для разблокировки.'),
    ('Nigeriyskoe', 'Я принц, у меня 5 миллионов долларов. Помогите перевести деньги, получите 30 процентов.'),
    ('Kazino spam', 'Поздравляем! Вы выиграли 1000000 рублей в нашей лотерее! Оплатите налог 5000 руб для получения приза.'),
    ('Krypto scam', 'Отправь 0.1 BTC и получи вдвое! Elon Musk crypto giveaway! Только сегодня!'),
    ('Shantazh', 'У нас есть ваше интимное видео. Заплатите 500$ иначе расскажем всем.'),
    ('Bezopas', 'Привет! Как дела? Встретимся в кафе завтра в 3 часа?'),
    ('URL-phishing', 'http://sberbank-secure-login.xyz/verify'),
    ('URL-safe', 'https://google.com'),
]

for name, msg in tests:
    if msg.startswith('http'):
        r = analyze_url(msg)
    else:
        r = analyze_message(msg)
    cats = r.get('category_scores', {})
    print(f"{name:25} | score={r['risk_score']:3} | {r['risk_level']:6} | flags={len(r['flags'])}"
          f" | P={cats.get('phishing',0)} F={cats.get('fraud',0)} S={cats.get('spam',0)} M={cats.get('manipulation',0)}")
