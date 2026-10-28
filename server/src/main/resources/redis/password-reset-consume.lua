if redis.call('GET', KEYS[2]) ~= ARGV[2] then return 0 end
if redis.call('HGET', KEYS[1], 'phase') ~= 'RESET' then return 0 end
if redis.call('HGET', KEYS[1], 'userId') ~= ARGV[2] then return 0 end
if redis.call('HGET', KEYS[1], 'grantHash') ~= ARGV[1] then return 0 end
redis.call('DEL', KEYS[1], KEYS[2])
return 1
