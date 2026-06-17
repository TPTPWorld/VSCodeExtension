tff(human_type,type,
    human: $tType ).

tff(grade_type,type,
    grade: $tType ).

tff(grade_of_decl,type,
    grade_of: human > grade ).

tff(created_equal_decl,type,
    created_equal: ( human * human ) > $o ).
