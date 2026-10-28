if redis.call('HGET', KEYS[1], 'phase') ~= 'OTP' then return 0 end
if redis.call('HGET', KEYS[1], 'otpHash') ~= ARGV[1] then
    local attempts = redis.call('HINCRBY', KEYS[1], 'attempts', 1)
    if attempts >= 5 then redis.call('DEL', KEYS[1]) end
    return 0
end
local userId = redis.call('HGET', KEYS[1], 'userId')
redis.call('HDEL', KEYS[1], 'otpHash', 'attempts')
redis.call('HSET', KEYS[1], 'phase', 'RESET', 'grantHash', ARGV[2])
redis.call('EXPIRE', KEYS[1], ARGV[3])
redis.call('SET', KEYS[2], userId, 'EX', ARGV[3])
return 1
