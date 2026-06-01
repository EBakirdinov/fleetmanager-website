<?php

namespace App\Service;

class Humandate
{
    protected $container;

    public function __construct($container)
    {
        $this->container = $container;
    }

    public function convert($date)
    {
        // seconds ago
        $seconds = time() - strtotime($date);

        $humanTime = '';

        if ($seconds < 60) // less than a minute
        {
            $humanTime = $this->_humanTime($seconds, 'second', 'seconds', 'seconds');
        }
        else if ($seconds < 3600) // less than an hour
        {
            $minutes = round($seconds / 60);
            $humanTime = $this->_humanTime($minutes, 'minute', 'minutes', 'minutes');
        }
        else if ($seconds < 86400) // less than a day
        {
            $hours = round($seconds / 3600);
            $humanTime = $this->_humanTime($hours, 'hour', 'hours', 'hours');
        }
        else if ($seconds < 2592000) // less than a month
        {
            $days = round($seconds / 86400);
            $humanTime = $this->_humanTime($days, 'day', 'days', 'days');
        }
        else if ($seconds < 31104000) // less than a year
        {
            $months = round($seconds / 2592000);
            $humanTime = $this->_humanTime($months, 'month', 'months', 'months');
        }
        else // more than a year
        {
            $years = round($seconds / 31104000);
            $humanTime = $this->_humanTime($years, 'year', 'years', 'years');
        }

        $humanTime .= ' '.'ago';

        return $humanTime;
    }

    private function _humanTime($value, $oneWord, $twoThreeFourWord, $otherWord)
    {
        $humanTime = '';

        $lastDigit = substr($value, -1);
        $lastButOneDigit = strlen($value) > 1 ? substr($value, -2, 1) : '';

        if ($lastButOneDigit == '1')
        {
            $humanTime .=  $value . ' ' . $otherWord;
        }
        else
        {
            switch ($lastDigit)
            {
                case '1':
                    $humanTime .= $value . ' ' . $oneWord;
                    break;
                case '2':
                case '3':
                case '4':
                    $humanTime .= $value . ' ' . $twoThreeFourWord;
                    break;
                default:
                    $humanTime .= $value . ' ' . $otherWord;
                    break;
            }
        }

        return $humanTime;
    }
}