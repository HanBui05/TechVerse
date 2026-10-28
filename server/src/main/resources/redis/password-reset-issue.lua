-- Replacing the state also invalidates a previously verified reset grant.
redis.call('DEL', KEYS[1])
redis.call('HSET', KEYS[1], 'phase', 'OTP', 'userId', ARGV[1], 'otpHash', ARGV[2], 'attempts', '0')
redis.call('EXPIRE', KEYS[1], ARGV[3])
return 1
